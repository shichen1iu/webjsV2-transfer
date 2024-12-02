import { address } from "@solana/web3.js";

import fs from "fs";

async () => {
    //使用address 而不是 publickey
    //address可以检查我们输入的Publickey是否合法
  const receiver = address("5KcXQcB2mJXehp86Gmg2ydWsoEKvDt7M9Y8bdHCnbmzY");
  
  const receiver2 = address("52KcXQc223B2mJXehp86Gmg2ydWsoEKvDt7M9Y8bdHCnbmzY");
};
