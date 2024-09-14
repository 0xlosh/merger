import { Command, Option } from 'nest-commander';
import {
  getUtxos,
  OpenMinterTokenInfo,
  getTokenMinter,
  logerror,
  getTokenMinterCount,
  isOpenMinter,
  sleep,
  needRetry,
  unScaleByDecimals,
  getTokens,
  btc,
  TokenMetadata,
} from 'src/common';
import { openMint } from './ft.open-minter';
import { ConfigService, SpendService, WalletService } from 'src/providers';
import { Inject } from '@nestjs/common';
import { log } from 'console';
import { findTokenMetadataById, scaleConfig } from 'src/token';
import Decimal from 'decimal.js';
import {
  BoardcastCommand,
  BoardcastCommandOptions,
} from '../boardcast.command';
import { broadcastMergeTokenTxs, mergeTokens } from '../send/merge';
import { calcTotalAmount, sendToken } from '../send/ft';
import { pickLargeFeeUtxo } from '../send/pick';

interface MergeCommandOptions extends BoardcastCommandOptions {
  id: string;
  new?: number;
}

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

@Command({
  name: 'merge',
  description: 'Merge a token',
})
export class MergeCommand extends BoardcastCommand {
  constructor(
    @Inject() private readonly spendService: SpendService,
    @Inject() protected readonly walletService: WalletService,
    @Inject() protected readonly configService: ConfigService,
  ) {
    super(spendService, walletService, configService);
  }

  async cat_cli_run(
    passedParams: string[],
    options?: MergeCommandOptions,
  ): Promise<void> {
    try {
      if (options.id) {
        const address = this.walletService.getAddress();
        const token = await findTokenMetadataById(
          this.configService,
          options.id,
        );

        if (!token) {
          console.error(`No token found for tokenId: ${options.id}`);
          return;
        }

        const scaledInfo = scaleConfig(token.info as OpenMinterTokenInfo);

        console.log("Scaled Info", scaledInfo)

        const MAX_RETRY_COUNT = 10;

        for (let index = 0; index < MAX_RETRY_COUNT; index++) {
          await this.mergeTokens(token, address);
          console.log(
            `Done merging tokens!`,
          );
          return;
        }
        console.error(`mint token [${token.info.symbol}] failed`);
      } else {
        throw new Error('expect a ID option');
      }
    } catch (error) {
      logerror('mint failed!', error);
    }
  }


  async mergeTokens(metadata: TokenMetadata, address: btc.Addres) {
    const res = await getTokens(
      this.configService,
      this.spendService,
      metadata,
      address,
    );

    if (res !== null) {
      const { contracts: tokenContracts } = res;

      if (tokenContracts.length > 1) {
        const cachedTxs: Map<string, btc.Transaction> = new Map();
        console.info(`Start merging your [${metadata.info.symbol}] tokens ...`);

        const feeUtxos = await this.getFeeUTXOs(address);
        console.info(`Current Fee Rate ${await this.getFeeRate()}`)
        const feeRate = Math.floor(await this.getFeeRate() * 1);
				console.info(`Using fee rate of ${feeRate} to send txn`);
        if (feeRate > 7000) {
          console.warn("fee too high")
          return
        }

        console.info(`Using fee rate of ${feeRate} to send txn`);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [newTokens, newFeeUtxos, e] = await mergeTokens(
          this.configService,
          this.walletService,
          this.spendService,
          feeUtxos,
          feeRate,
          metadata,
          tokenContracts,
          address,
          cachedTxs,
        );

        if (e instanceof Error) {
          logerror('merge token failed!', e);
          return;
        }

        const feeUtxo = pickLargeFeeUtxo(newFeeUtxos);

        if (newTokens.length > 1) {
          const amountTobeMerge = calcTotalAmount(newTokens);
          const result = await sendToken(
            this.configService,
            this.walletService,
            feeUtxo,
            feeRate,
            metadata,
            newTokens,
            address,
            address,
            amountTobeMerge,
            cachedTxs,
          );
          if (result) {
            await broadcastMergeTokenTxs(
              this.configService,
              this.walletService,
              this.spendService,
              [result.commitTx, result.revealTx],
            );

            console.info(
              `Merging your [${metadata.info.symbol}] tokens in txid: ${result.revealTx.id} ...`,
            );
          }
        }
      }
    }
  }

  @Option({
    flags: '-i, --id [tokenId]',
    description: 'ID of the token',
  })
  parseId(val: string): string {
    return val;
  }

  async getFeeUTXOs(address: btc.Address) {
    let feeUtxos = await getUtxos(
      this.configService,
      this.walletService,
      address,
    );

    console.log(feeUtxos);

    feeUtxos = feeUtxos.filter((utxo) => {
      return this.spendService.isUnspent(utxo);
    });

    if (feeUtxos.length === 0) {
      console.warn('Insufficient satoshis balance! 3');
      return [];
    }
    return feeUtxos;
  }
}