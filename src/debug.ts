/* Default logger channels and their settings. */

export type ChannelName = "default" | "main" | "memory" | "cpu" | "creeps" | "labs" | "trade" | "strategy";
interface ChannelConfig {
  name: string;
  color: string;
}
interface ChannelOptions {
  disabled?: boolean;
}

declare global {
  interface Memory {
    logger: {
      channelSettings?: Partial<Record<ChannelName, ChannelOptions>>;
    };
  }
}

const channels: Record<ChannelName, ChannelConfig> = {
  default: {
    name: "Default",
    color: "#dddddd"
  },
  main: {
    name: "Main Loop",
    color: "#ffffff"
  },
  memory: {
    name: "Memory",
    color: "#ff80ff"
  },
  cpu: {
    name: "CPU",
    color: "#ff8080"
  },
  creeps: {
    name: "Creeps",
    color: "#80ff80"
  },
  labs: {
    name: "Labs",
    color: "#8080ff"
  },
  trade: {
    name: "Trade",
    color: "#80ffff"
  },
  strategy: {
    name: "Strategy",
    color: "#ffff80"
  }
};

/**
 * Loggers are used for simple, prettified output to the console.
 * @constructor
 *
 * @param {string} channel
 *   The name of the channel to get a logger for.
 * @param {string|null} roomName
 *   The name of the room to log this message for, or null if logging globally.
 */
export default class Logger {
  protected channel: ChannelName;
  protected channelName: string;
  protected color: string;
  protected roomName: string;
  protected active: boolean;
  protected prefix: string;

  public constructor(channel: ChannelName, roomName: string) {
    this.channel = channel;
    this.channelName = ("          " + this.channel).slice(-10);
    this.color = channels.default.color;
    this.roomName = roomName;
    this.active = true;

    if (channels[this.channel]) {
      this.channelName = ("          " + channels[this.channel].name).slice(-10);
      if (channels[this.channel].color) {
        this.color = channels[this.channel].color;
      }
    }

    this.prefix = this.getOutputPrefix();

    if (!Memory.logger) {
      Memory.logger = {};
    }

    if (!Memory.logger.channelSettings) {
      Memory.logger.channelSettings = {};
    }

    if (Memory.logger.channelSettings[this.channel] && Memory.logger.channelSettings[this.channel]?.disabled) {
      this.active = false;
      // @todo allow overriding for single rooms.
    }
  }

  /**
   * Decides whether this logger channel should be displayed.
   *
   * @param {boolean} enabled
   *   True to show this channel in the console.
   */
  public setEnabled(enabled: boolean): void {
    if (!Memory.logger.channelSettings) {
      Memory.logger.channelSettings = {};
    }

    if (!Memory.logger.channelSettings[this.channel]) {
      Memory.logger.channelSettings[this.channel] = {};
    }

    Memory.logger.channelSettings[this.channel].disabled = !enabled;
  }

  /**
   * Enables displaying of this channel.
   */
  public enable(): void {
    this.setEnabled(true);
  }

  /**
   * Disables displaying of this channel.
   */
  public disable(): void {
    this.setEnabled(false);
  }

  /**
   * Determines prefix of lines logged through this channel.
   *
   * @return {string}
   *   Line prefix containing pretty channel name, colors and room name.
   */
  public getOutputPrefix(): string {
    let prefix = '[<font color="' + this.color + '">' + this.channelName + "</font>";
    prefix += "]";
    if (this.roomName) {
      let roomColor = "ffff80";
      if (Game.rooms[this.roomName]) {
        if (!Game.rooms[this.roomName].controller) {
          roomColor = "dddddd";
        } else if (Game.rooms[this.roomName].controller.my) {
          roomColor = "80ff80";
        } else if (Game.rooms[this.roomName].controller.owner) {
          roomColor = "ff8080";
        }
      }

      prefix += '[<font color="#' + roomColor + '">' + this.roomName + "</font>]";
    } else {
      prefix += "        ";
    }

    return prefix;
  }

  /**
   * Logs a degub line.
   */
  public debug(...args: any[]): void {
    if (!this.active) return;

    const prefix = '<font color="#606060">' + this.prefix;

    console.log(prefix, ...args, "</font>");
  }

  /**
   * Logs a normal line.
   */
  public info(...args: any[]): void {
    if (!this.active) return;

    const prefix = this.prefix;

    console.log(prefix, ...args);
  }

  /**
   * Logs an error.
   */
  public error(...args: any[]): void {
    const prefix = '<font color="#ff8080">' + this.prefix;

    console.log(prefix, ...args, "</font>");
  }
}
