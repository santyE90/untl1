export type ServiceErrorCode = "validation" | "not_found" | "unauthorized" | "conflict" | "unexpected";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ServiceErrorCode; message: string } };

export const serviceSuccess = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
export const serviceFailure = (code: ServiceErrorCode, message: string): ServiceResult<never> => ({ ok: false, error: { code, message } });
