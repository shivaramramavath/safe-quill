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

export class SessionClaimedEvent {
  constructor(
    public readonly userId: string,
    public readonly guestSessionId: string,
    public readonly savedSessionId: string,
  ) {}
}
