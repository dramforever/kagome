export class Scheduler {
    pending: (() => void)[];
    running: boolean;

    constructor() {
        this.pending = [];
        this.running = false;
    }

    add(action: () => void) {
        this.pending.push(action);
        this.begin();
    }

    begin() {
        if (this.running) return;

        this.running = true;
        while (this.pending.length) {
            this.pending.shift()!();
        }
        this.running = false;
    }
}

export const globalScheduler: Scheduler = new Scheduler();
