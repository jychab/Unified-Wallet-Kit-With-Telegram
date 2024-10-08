import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SendOptions,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { Dispatch, SetStateAction } from 'react';
import { PersistentCache } from './cache';

export const cache = new PersistentCache(60 * 60 * 1000); // 1hr TTL

export function createAdapterSimulationCallback(
  setTransactionSimulation: Dispatch<
    SetStateAction<
      | {
          transaction?: Transaction | VersionedTransaction;
          error?: string;
          message?: string;
          onApproval: () => void;
          onCancel: () => void;
        }
      | undefined
    >
  >,
  setShowWalletModal: (showWalletModal: boolean) => void,
) {
  const simulationCallback = (transaction?: Transaction | VersionedTransaction, message?: string) => {
    return new Promise(
      (resolve: (value: { result: boolean; onCompletion?: () => void; onError?: (error: string) => void }) => any) => {
        let timeoutId;

        const onCompletion = () => {
          console.log('Transaction is signed');
          setShowWalletModal(false); // Close modal
        };
        const onError = (error: string) => {
          console.log('Error Occurred while signing transaction');
          setTransactionSimulation((prev) => (prev ? { ...prev, error } : undefined));
        };
        const onApproval = () => {
          console.log('Transaction approved by user');
          clearTimeout(timeoutId);
          resolve({ result: true, onCompletion, onError }); // User approved
        };
        const onCancel = () => {
          console.log('Transaction canceled by user');
          clearTimeout(timeoutId);
          setShowWalletModal(false); // Close modal
          resolve({ result: false, onCompletion, onError }); // User approved
        };

        console.log('Setting transaction simulation and opening modal');
        if (transaction) {
          setTransactionSimulation({
            transaction,
            onApproval,
            onCancel,
          });
        } else if (message) {
          setTransactionSimulation({
            message,
            onApproval,
            onCancel,
          });
        }
        setShowWalletModal(true);
        // Set up a timeout to automatically resolve after 1 minute (60000ms)
        timeoutId = setTimeout(() => {
          console.log('Transaction timed out after 1 minute');
          setShowWalletModal(false); // Close modal due to timeout
          resolve({ result: false, onCompletion, onError }); // User approved
        }, 60000); // 1 minute timeout
      },
    );
  };
  return simulationCallback;
}

export async function sendTransactionToBlockchain<T extends Transaction | VersionedTransaction>(
  rpcEndpoint: string,
  transaction: T,
  options?: SendOptions,
): Promise<TransactionSignature> {
  // Implement logic to send the transaction to the blockchain and get the signature
  const connection = new Connection(rpcEndpoint);
  const txSig = await connection.sendTransaction(transaction as VersionedTransaction, options);
  return txSig;
}

export async function getAssetsByOwner(rpcEndpoint: string, publicKey: string): Promise<any> {
  const response = await fetch(rpcEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'my-id',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: publicKey,
        page: 1, // Starts at 1
        limit: 1000,
        displayOptions: {
          showFungible: true, //return both fungible and non-fungible tokens
          showNativeBalance: true,
        },
      },
    }),
  });
  const { result } = await response.json();
  return result;
}

export async function getAssetsBatch(rpcEndpoint: string, mints: string[]): Promise<any> {
  const response = await fetch(rpcEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '',
      method: 'getAssetBatch',
      params: {
        ids: mints,
      },
    }),
  });
  const { result } = await response.json();
  return result;
}

export async function sendAndConfirmTransaction(tx: Uint8Array, connection: Connection): Promise<string> {
  try {
    const timeout = 60000;
    const startTime = Date.now();
    let txSig;

    while (Date.now() - startTime < timeout) {
      try {
        txSig = await connection.sendRawTransaction(tx, {
          skipPreflight: true,
        });

        return await pollTransactionConfirmation(connection, txSig);
      } catch (error) {
        continue;
      }
    }
    return txSig;
  } catch (e) {
    throw e;
  }
}

export async function buildAndSignTransaction(
  ixs: TransactionInstruction[],
  payer: PublicKey,
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>,
  connection: Connection,
  addressLookupTableAccounts?: AddressLookupTableAccount[],
) {
  let lookupTables = addressLookupTableAccounts || [];
  const recentBlockhash = await connection.getLatestBlockhash();
  if (ixs.length > 0) {
    const [microLamports, units] = await Promise.all([
      getPriorityFeeEstimate(ixs, payer, connection, lookupTables),
      getSimulationUnits(connection, ixs, payer, lookupTables),
    ]);
    ixs.unshift(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: microLamports,
      }),
    );
    if (units) {
      ixs.unshift(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: Math.ceil(Math.max(units * 1.1, 5000)),
        }),
      );
    }
  }
  let tx = new VersionedTransaction(
    new TransactionMessage({
      instructions: ixs,
      recentBlockhash: recentBlockhash.blockhash,
      payerKey: payer,
    }).compileToV0Message(lookupTables),
  );
  console.log('Versioned Tx:', tx);
  return await signTransaction(tx);
}

export async function pollTransactionConfirmation(
  connection: Connection,
  txSig: TransactionSignature,
): Promise<TransactionSignature> {
  // 15 second timeout
  const timeout = 15000;
  // 5 second retry interval
  const interval = 5000;
  let elapsed = 0;

  return new Promise<TransactionSignature>((resolve, reject) => {
    const intervalId = setInterval(async () => {
      elapsed += interval;

      if (elapsed >= timeout) {
        clearInterval(intervalId);
        reject(new Error(`Transaction ${txSig}'s confirmation timed out`));
      }

      const status = await connection.getSignatureStatus(txSig);

      if (status?.value?.confirmationStatus === 'confirmed') {
        clearInterval(intervalId);
        resolve(txSig);
      }
    }, interval);
  });
}

async function getPriorityFeeEstimate(
  testInstructions: TransactionInstruction[],
  payer: PublicKey,
  connection: Connection,
  lookupTables: AddressLookupTableAccount[],
) {
  const testVersionedTxn = new VersionedTransaction(
    new TransactionMessage({
      instructions: testInstructions,
      payerKey: payer,
      recentBlockhash: PublicKey.default.toString(),
    }).compileToV0Message(lookupTables),
  );
  const response = await fetch(connection.rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'getPriorityFeeEstimate',
      params: [
        {
          transaction: Buffer.from(testVersionedTxn.serialize()).toString('base64'),
          options: { recommended: true, transactionEncoding: 'base64' },
        },
      ],
    }),
  });
  const data = await response.json();
  return data.result.priorityFeeEstimate;
}

export async function getSimulationUnits(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: PublicKey,
  lookupTables: AddressLookupTableAccount[],
): Promise<number | undefined> {
  const testInstructions = [ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ...instructions];

  const testVersionedTxn = new VersionedTransaction(
    new TransactionMessage({
      instructions: testInstructions,
      payerKey: payer,
      recentBlockhash: PublicKey.default.toString(),
    }).compileToV0Message(lookupTables),
  );

  const simulation = await connection.simulateTransaction(testVersionedTxn, {
    replaceRecentBlockhash: true,
    sigVerify: false,
  });
  if (simulation.value.err) {
    return undefined;
  }
  return simulation.value.unitsConsumed;
}

export function getInitData() {
  let initDataRaw;
  try {
    initDataRaw = retrieveLaunchParams().initDataRaw;
  } catch (e) {
    throw new Error('User not on telegram.');
  }
  if (!initDataRaw) throw new Error('Telegram User not found.');
  return initDataRaw;
}
