import { randomUUID } from "./utility";
import { Room } from "./room";


/**
 * A chat message.
 */
export class Message {

    // The message uuid.
    private _id: string;

    public get uuid():string{
        return this._id;
    }

    /**
     * Message are send by account and send on channel by the application by a given user.
     * @param from The author of message
     * @param text The message text, can by html text.
     * @param date The message date
     */
    constructor(public from: string, public text: string, public date: Date, id?: string) {
        // generate the message uuid.
        this._id = randomUUID();
        if (id != undefined) {
            this._id = id;
        }
    }
}

export class MessageView {

    // The div of the the message view.
    private div: any;

    /**
     * Display the message inside it parent container.
     * @param parent 
     * @param message 
     */
    constructor(parent: any, message: Message, room: Room) {
        // Set the icon with the message color.
        let color = room.getParticipantColor(message.from);

        let html = `
            <div class="row" id="${message.uuid}">
                <div class="col s12 m4" style="display: flex; flex-direction: column; padding: 10px;">
                    <i class="material-icons" name="${message.from + "_ico"}" style="color:${color};">account_circle</i>
                    <span>${message.from}</span>
                    <span>${message.date.toLocaleDateString() + " " + message.date.toLocaleTimeString()}</span>
                </div>
                <div class="card-panel class="col s12 m8" style="flex-grow: 1; padding: 10px; margin: 10px; overflow-y: auto;">
                    ${message.text}
                </div>
            </div>
        `

        // Initialyse the html elements.
        let range = document.createRange();
        let div = range.createContextualFragment(html);
        parent.appendChild(div)

        // keep the div in the member variable.
        this.div = document.getElementById(message.uuid);
    }
}