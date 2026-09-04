export const ERROR_KEYS = {
  requestTooLarge: "request.body_too_large",
  invalidJson: "request.invalid_json",
  objectRequired: "request.object_required",
  fieldRequired: "request.field_required",
  routeNotFound: "route.not_found",
  internal: "server.internal_error",
  adminRequired: "auth.admin_required",
  passwordTooShort: "account.password_too_short",
  secretMissing: "account.auth_secret_missing",
  emailInvalid: "account.email_invalid",
  accountExists: "account.already_exists",
  credentialsInvalid: "account.invalid_credentials",
  productUnknown: "product.unknown",
  productNotFound: "product.not_found",
  priceInvalid: "product.price_invalid",
  itemCountInvalid: "payment.item_count_invalid",
  quantityInvalid: "payment.quantity_invalid",
  serviceInvalid: "service.invalid"
} as const;

export type ErrorKey = typeof ERROR_KEYS[keyof typeof ERROR_KEYS];
