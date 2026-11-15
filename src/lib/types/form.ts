/** Explicit, non-sensitive feedback returned from administrative server actions. */
export type FormActionResult = {
  ok: boolean;
  message: string;
};

export type FormAction = (data: FormData) => Promise<void | FormActionResult>;
