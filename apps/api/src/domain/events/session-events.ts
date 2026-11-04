export class GuestSessionCreatedEvent {
  constructor(public readonly sessionId: string) {}
}

export class DraftUpdatedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly charCount: number,
  ) {}
}

export class SessionClearedEvent {
  constructor(public readonly sessionId: string) {}
}
