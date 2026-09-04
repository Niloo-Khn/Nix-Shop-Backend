import { createAccountApp } from "./services/accounts.service.js"; import { createProductApp } from "./services/products.service.js"; import { createPaymentApp } from "./services/payments.service.js"; import { createHelpApp } from "./services/help.service.js";
import { ERROR_KEYS } from "./shared/message-keys.js";
const services={accounts:{port:4001,create:createAccountApp},products:{port:4002,create:createProductApp},payments:{port:4003,create:createPaymentApp},help:{port:4004,create:createHelpApp}} as const;
const name=process.env.SERVICE as keyof typeof services; const selected=services[name]; if(!selected)throw new Error(ERROR_KEYS.serviceInvalid); selected.create().listen(Number(process.env.PORT??selected.port));
