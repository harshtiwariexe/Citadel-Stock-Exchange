export const SUBSCRIBE = "SUBSCRIBE";
export const UNSUBSCRIBE = "UNSUBSCRIBE";

export type SubsribeMessage = {
  method: typeof SUBSCRIBE;
  params: string[];
};
export type UnsubsribeMessage = {
  method: typeof UNSUBSCRIBE;
  params: string[];
};

export type IncomingMessage = SubsribeMessage | UnsubsribeMessage;
