import { createAccountApp } from "./accounts.js"; import { createProductApp } from "./products.js"; import { createPaymentApp } from "./payments.js"; import { createHelpApp } from "./help.js";
import { ERROR_KEYS } from "./message-keys.js";
const services={accounts:{port:4001,create:createAccountApp},products:{port:4002,create:createProductApp},payments:{port:4003,create:createPaymentApp},help:{port:4004,create:createHelpApp}} as const;
const name=process.env.SERVICE as keyof typeof services; const selected=services[name]; if(!selected)throw new Error(ERROR_KEYS.serviceInvalid); selected.create().listen(Number(process.env.PORT??selected.port));
