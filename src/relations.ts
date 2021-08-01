"use strict";

/**
 * Relations determine how we act towards other users.
 * @constructor
 */
export default class Relations {
  protected allies: string[];

  public constructor() {
    this.allies = [];
  }

  /**
   * Checks if a user is considered our ally.
   *
   * @param {string} username
   *   The name of the user to check.
   *
   * @return {boolean} true if the user is our ally.
   */
  public isAlly(username: string): boolean {
    return this.allies.indexOf(username) !== -1;
  }
}
