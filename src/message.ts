import { randomUUID } from "./utility";


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
    constructor(parent: any, message: Message) {
        let html = `
            <div class="card-panel" id="${message.uuid}" style="display: flex; flex-direction: column;">
                <div >
                    
                </div>
                <div style="flex: auto; padding: 0px; margin: 0px; overflow-y: auto;">
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