import {
  address,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getBase58Encoder,
  getBase64EncodedWireTransaction,
  getComputeUnitEstimateForTransactionMessageFactory,
  getSignatureFromTransaction,
  isSolanaError,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from "@solana/web3.js";
import {
  getSystemErrorMessage,
  getTransferSolInstruction,
  isSystemError,
} from "@solana-program/system";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";

const authority = require("./authority.json");

async function main() {
  const destinationAddress = address(
    "5KcXQcB2mJXehp86Gmg2ydWsoEKvDt7M9Y8bdHCnbmzY"
  );

  const sourceKeypair = await createKeyPairSignerFromBytes(
    Uint8Array.from(authority)
  );

  const url =
    "https://devnet.helius-rpc.com/?api-key=47fcd2c1-bfb0-4224-8257-ce200078152a";
  const rpc = createSolanaRpc(
    "https://devnet.helius-rpc.com/?api-key=47fcd2c1-bfb0-4224-8257-ce200078152a"
  );
  const rpcSubscriptions = createSolanaRpcSubscriptions(
    "wss://devnet.helius-rpc.com/?api-key=47fcd2c1-bfb0-4224-8257-ce200078152a"
  );

  const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  //创建交易指令
  const instruction = getTransferSolInstruction({
    amount: lamports(BigInt(1_000_000_000)),
    destination: destinationAddress,
    source: sourceKeypair,
  });
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(sourceKeypair.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstruction(instruction, tx)
  );
  console.log("Transaction message created");

  //签名
  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage
  );
  console.log("Transaction signed");

  const base64EncodedWireTransaction =
    getBase64EncodedWireTransaction(signedTransaction);

  //   const response = await fetch(url, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({
  //       jsonrpc: "2.0",
  //       id: "helius-example",
  //       method: "getPriorityFeeEstimate",
  //       params: [
  //         {
  //           transaction: base64EncodedWireTransaction,
  //           options: {
  //             transactionEncoding: "base64",
  //             recommended: true,
  //           },
  //         },
  //       ],
  //     }),
  //   });
  //   const { result } = await response.json();
  //   const priorityFee = result.priorityFeeEstimate;
  //   console.log("Setting priority fee to ", priorityFee);

  const priorityFee = 100_000;

  const getComputeUnitEstimateForTransactionMessage =
    getComputeUnitEstimateForTransactionMessageFactory({
      rpc,
    });
  // Request an estimate of the actual compute units this message will consume.
  let computeUnitsEstimate = await getComputeUnitEstimateForTransactionMessage(
    transactionMessage
  );
  computeUnitsEstimate =
    computeUnitsEstimate < 1000 ? 1000 : Math.ceil(computeUnitsEstimate * 1.1);
  console.log("Setting compute units to ", computeUnitsEstimate);

  const { value: finalLatestBlockhash } = await rpc.getLatestBlockhash().send();

  const finalTransactionMessage = appendTransactionMessageInstructions(
    [
      getSetComputeUnitPriceInstruction({ microLamports: priorityFee }),
      getSetComputeUnitLimitInstruction({ units: computeUnitsEstimate }),
    ],
    transactionMessage
  );

  setTransactionMessageLifetimeUsingBlockhash(
    finalLatestBlockhash,
    finalTransactionMessage
  );

  const finalSignedTransaction = await signTransactionMessageWithSigners(
    finalTransactionMessage
  );
  console.log("Rebuilt the transaction and signed it");

  try {
    console.log("Sending and confirming transaction");
    await sendAndConfirmTransaction(finalSignedTransaction, {
      commitment: "confirmed",
      maxRetries: BigInt(0),
      skipPreflight: true,
    });
    console.log(
      "Transfer confirmed: ",
      getSignatureFromTransaction(finalSignedTransaction)
    );
  } catch (e) {
    if (
      isSolanaError(
        e,
        SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
      )
    ) {
      const preflightErrorContext = e.context;
      const preflightErrorMessage = e.message;
      const errorDetailMessage = isSystemError(e.cause, finalTransactionMessage)
        ? getSystemErrorMessage(e.cause.context.code)
        : e.cause
        ? e.cause.message
        : "";
      console.error(
        preflightErrorContext,
        "%s: %s",
        preflightErrorMessage,
        errorDetailMessage
      );
    } else {
      throw e;
    }
  }
}

main();
