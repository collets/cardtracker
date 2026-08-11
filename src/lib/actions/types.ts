export type ActionResult<T = undefined> =
  | {
      ok: true;
      message: string;
      data?: T;
    }
  | {
      ok: false;
      message: string;
    };

export type FeedbackAction<T = undefined> = (
  formData: FormData,
) => Promise<ActionResult<T>>;
