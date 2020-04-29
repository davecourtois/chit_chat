
import "../../css/components/messageInput.css"
import { randomUUID } from "../utility";
import { Room } from "../room";
import { applicationModel } from "..";

/**
 * That component is use to compose a message.
 */
export class MessageInput {

    // The input container...
    private div: any;
    private uuid: string;

    // Interface elements...
    private imageBtn: any;
    private sendBtn: any;
    private textArea: any;
    private room: Room;

    constructor(parent: any, room: Room) {
        
        // keep reference to the room.
        this.room = room;

        // The uuid of the div.
        this.uuid = randomUUID();

        let html = `
        <div id="${this.uuid}" class="card-panel" style="height: 144px; padding: 10px; display: flex; flex-direction: column;">
            <textarea id="${this.uuid + "_textarea"}" style="flex-grow: 1; padding: 5px; resize: none;" placeholder="type your message here..."></textarea>
            <div style="display:flex; flex-direction: row; margin-top: 10px; justify-content: flex-end;">
                <i id="${this.uuid + "_picture_btn"}" class="material-icons right">image</i>
                <i id="${this.uuid + "_send_btn"}" class="material-icons right disabled">send</i>
            </div>
        </div>
        `
        // Initialyse the html elements.
        let range = document.createRange();
        let div = range.createContextualFragment(html);
        parent.appendChild(div)

        // keep the div in the member variable.
        this.div = document.getElementById(this.uuid);

        this.imageBtn = document.getElementById(this.uuid + "_picture_btn");
        this.sendBtn = document.getElementById(this.uuid + "_send_btn");
        this.textArea = document.getElementById(this.uuid + "_textarea");

        // The actions...

        // Make icon appear like buttons...
        this.sendBtn.onmouseover = ()=>{
            if(!this.sendBtn.classList.contains("disabled")){
                this.sendBtn.style.cursor = "pointer";
            }
        }

        this.sendBtn.onmouseleave = ()=>{
            this.sendBtn.style.cursor = "default";
        }

        this.imageBtn.onmouseover = ()=>{
            this.imageBtn.style.cursor = "pointer";
        }

        this.imageBtn.onmouseleave = ()=>{
            this.imageBtn.style.cursor = "default";
        }

        // Now the message input...
        this.textArea.onkeyup = ()=>{
            if(this.textArea.value.length > 0){
                this.sendBtn.classList.remove("disabled");
            }else{
                this.sendBtn.classList.add("disabled");
            }
        }

        this.sendBtn.onclick = ()=>{
            this.send();
        }
    }

    focus(){
        this.textArea.focus();
        this.room.view.scrollDown()
    }

    /**
     * Send the message...
     */
    send(){
        let text = this.textArea.value;
        this.textArea.value = "";
        this.sendBtn.classList.add("disabled");

        // Now I will publish the message on the room
        this.room.publish(applicationModel.account.name, text)
    }

}