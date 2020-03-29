

/**
 * A chat message.
 */
export class Message {

    // The message uuid.
    private uuid: string;

    /**
     * Message are send by account and send on channel by the application by a given user.
     * @param from The author of message
     * @param text The message text, can by html text.
     * @param date The message date
     */
    constructor(public from: string, public text: string, public date: Date) {

    }

    /**
     * Ceci est une description de la fonction
     * @param toto Ceci est un parametre
     */
    display(toto: string){

    }
}

export class MessageView {
    
    constructor(){

    }
}