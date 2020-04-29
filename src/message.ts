import { randomUUID } from "./utility";
import { Room } from "./room";
import { ReplaceOneRqst, ReplaceOneRsp } from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { application, domain, applicationModel } from ".";
import { Model } from "./model";
import { View } from "./components/view";


/**
 * A chat message.
 */
export class Message extends Model {

    // The message uuid.
    private _id: string;
    private listener: string;
    private likes: Array<string>;
    private dislikes: Array<string>;

    // A message can contain replies that are also message,
    // but a replies cannot contain a reply...
    private replies: Array<Message>;

    public get uuid(): string {
        return this._id;
    }

    /**
     * Message are send by account and send on channel by the application by a given user.
     * @param from The author of message
     * @param text The message text, can by html text.
     * @param date The message date
     */
    constructor(public from: string, public text: string, public date: Date, id?: string, likes?: Array<string>, dislikes?: Array<string>, replies?: Array<Message>) {
        super();

        // generate the message uuid.
        this._id = randomUUID();
        if (id != undefined) {
            this._id = id;
        }

        this.likes = new Array<string>();
        if (likes != undefined) {
            this.likes = likes;
        }

        this.dislikes = new Array<string>();
        if (dislikes != undefined) {
            this.dislikes = dislikes;
        }

        this.replies = new Array<Message>();
        if (replies != undefined) {
            this.replies = replies;
        }

        // Here I will connect an event listner...
        Model.eventHub.subscribe(this._id,
            (uuid: string) => {
                this.listener = uuid;
            }, (data: string) => {
                // update the model
                this.fromString(data);
                // and refresh the view.
                if (this.view != undefined) {
                    (<MessageView>this.view).refresh();
                }
            }, false)
    }

    // disconnect from the view...
    delete() {
        Model.eventHub.unSubscribe(this._id, this.listener);
    }

    // Serialyse a message to a string
    toString(): string {
        let view = this.view;
        this.view = null;
        let str = JSON.stringify(this);
        this.view = view
        return str;
    }

    // Set message values from string.
    fromString(str: string) {
        let msgObj = JSON.parse(str);
        this.text = msgObj.text;
        this.from = msgObj.from;
        this.date = new Date(msgObj.Date);
        this.likes = msgObj.likes;
        this.dislikes = msgObj.dislikes;
    }

    // Reply to a particular message in the discution.
    reply(msg: Message, room: Room, callback: () => void, errorCallback: (err: any) => void) {
        this.replies.push(msg);
        // save the message.
        this.save(room, () => {
            // publish message change on the nework to update interfaces.
            Model.eventHub.publish(this._id, this.toString(), false);
            callback();
        }, errorCallback)
    }

    // Like and Dislike funtionalities...
    whoLikesIt(): Array<string> {
        return this.likes
    }

    whoDislikesIt(): Array<string> {
        return this.dislikes
    }

    howManyLikes() {
        return this.likes.length;
    }

    howManyDislikes() {
        return this.dislikes.length;
    }

    // Append/Remove a like to the message...
    like(participantId: string, room: Room, callback: () => void, errorCallback: (err: any) => void) {
        let index = this.likes.indexOf(participantId)
        if (index == -1) {
            this.likes.push(participantId);
        } else {
            this.likes.splice(index, 1);
        }
        // Also remove it from the dislikes...
        index = this.dislikes.indexOf(participantId)
        if (index != -1) {
            this.dislikes.splice(index, 1);
        }

        // save the message.
        this.save(room, () => {
            // publish message change on the nework to update interfaces.
            Model.eventHub.publish(this._id, this.toString(), false);
            callback();
        }, errorCallback)
    }

    // Append/Remove a dislike to the message...
    dislike(participantId: string, room: Room, callback: () => void, errorCallback: (err: any) => void) {
        let index = this.dislikes.indexOf(participantId)
        if (index == -1) {
            this.dislikes.push(participantId);
        } else {
            this.dislikes.splice(index, 1);
        }

        // Also remove it from the likes...
        index = this.likes.indexOf(participantId)
        if (index != -1) {
            this.likes.splice(index, 1);
        }

        // save the message.
        this.save(room, () => {
            Model.eventHub.publish(this._id, this.toString(), false);
            callback();
        }, errorCallback)
    }

    // Save the message...
    save(room: Room, callback: () => void, errorCallback: (err: any) => void) {
        let rqst = new ReplaceOneRqst();
        rqst.setId("chitchat_db");
        rqst.setDatabase("chitchat_db");
        rqst.setCollection(room.name);
        rqst.setQuery(`{"_id":"` + this._id + `"}`);
        rqst.setValue(this.toString());
        rqst.setOptions(`[{"upsert": true}]`);

        // call persist data
        Model.globular.persistenceService
            .replaceOne(rqst, {
                token: localStorage.getItem("user_token"),
                application: application,
                domain: domain
            })
            .then((rsp: ReplaceOneRsp) => {
                // Here I will return the value with it
                callback()
            })
            .catch((err: any) => {
                console.log(err);
                let msg = JSON.parse(err.message);
                errorCallback(msg);
            });
    }

}

export class MessageView extends View {

    // The div of the the message view.
    private div: any;

    // Buttons
    private replyBtn: any;
    private likeBtn: any;
    private likeCount: any;
    private dislikeBtn: any;
    private dislikeCount: any;
    private dislikeDiv: any;
    private likeDiv: any;


    /**
     * Display the message inside it parent container.
     * @param parent 
     * @param message 
     */
    constructor(parent: any, message: Message, room: Room) {

        super(message);

        // Set the icon with the message color.
        let color = room.getParticipantColor(message.from);
        let border = `border: 1px solid ${color};`

        let html = `
            <div class="row" id="${message.uuid}">
                <div class="col s12 m4 l3" style="display: flex; flex-direction: column; padding: 10px;">
                    <i class="material-icons" name="${message.from + "_ico"}" style="color:${color};">account_circle</i>
                    <span>${message.from}</span>
                    <span>${message.date.toLocaleDateString() + " " + message.date.toLocaleTimeString()}</span>
                </div>
                <div>
                    <div name="${message.from + "_message_box"}" class="card-panel class="col s12 m8 l9" style="flex-grow: 1; padding: 10px; margin: 10px; overflow-y: auto; ${border}">
                        <div class="card-content">
                            <p>
                                ${message.text}
                            </p>
                        </div>
                        <div class="card-actions">
                           <a id="${message.uuid + "_reply_btn"}" href="javascript:void(0)">reply</a>
                        </div>
                    </div>
                    <div class="right" style="padding-right: 25px;">
                        <span id="${message.uuid + "_like_div"}" style="position: relative;">
                            <i id="${message.uuid + "_like_btn"}" class="tiny material-icons">thumb_up</i>
                            <a id="${message.uuid + "_like_count"}" href="javascript:void(0)">${message.howManyLikes()}</a>
                        </span>
                        <span id="${message.uuid + "_dislike_div"}" style="padding-left: 15px; position: relative;">
                            <i id="${message.uuid + "_dislike_btn"}" class="tiny material-icons">thumb_down</i>
                            <a id="${message.uuid + "_dislike_count"}" href="javascript:void(0)">${message.howManyDislikes()}</a>
                        </span>
                    </div>
                </div>
            </div>
        `

        // Initialyse the html elements.
        let range = document.createRange();
        let div = range.createContextualFragment(html);
        parent.appendChild(div)

        // keep the div in the member variable.
        this.div = document.getElementById(message.uuid);

        // Now I will get the reference to user
        this.replyBtn = document.getElementById(message.uuid + "_reply_btn");

        this.likeDiv = document.getElementById(message.uuid + "_like_div")
        this.likeBtn = document.getElementById(message.uuid + "_like_btn");
        this.likeCount = document.getElementById(message.uuid + "_like_count");

        this.dislikeDiv = document.getElementById(message.uuid + "_dislike_div")
        this.dislikeBtn = document.getElementById(message.uuid + "_dislike_btn");
        this.dislikeCount = document.getElementById(message.uuid + "_dislike_count");


        // Now the actions.
        this.dislikeBtn.onmouseover = this.likeBtn.onmouseover = function () {
            this.style.cursor = "pointer"
        }

        this.dislikeBtn.onmouseleave = this.likeBtn.onmouseleave = function () {
            this.style.cursor = "default"
        }

        this.dislikeDiv.onmouseenter = () => {
            this.showDislikeList()
        }

        this.likeDiv.onmouseenter = () => {
            this.showLikeList()
        }

        // Now the like click event...
        this.likeBtn.onclick = () => {
            message.like(applicationModel.account.name, room,
                () => {
                    this.displayMessage("You like it!", 3000)
                },
                (err: any) => {

                }
            )
        }

        // The dilike button...
        this.dislikeBtn.onclick = () => {
            message.dislike(applicationModel.account.name, room,
                () => {
                    this.displayMessage("Yeah, well, that's just, like, your opinion, man!", 3000)
                },
                (err: any) => {

                }
            )
        }

        // The reply to message.
        this.replyBtn.onclick = ()=>{
            room.setReplyTo(<Message>this.model)
        }
    }

    // display the list of dislike...
    showDislikeList() {
        let dislikes = (<Message>this.model).whoDislikesIt()
        if (dislikes.length > 0 && document.getElementById((<Message>this.model).uuid + "_dislike_lst") == undefined) {
            // display the div.
            let div = document.createElement("div")
            div.id = (<Message>this.model).uuid + "_dislike_lst"
            div.style.position = "absolute"
            div.style.zIndex = "1000";
            div.style.backgroundColor = "rgba(0,0,0,0.87)";
            div.style.padding = "0px 5px 0px 5px"
            div.style.color = "white";

            let ul = document.createElement("ul")
            div.appendChild(ul)
            document.body.appendChild(div)

            var viewportOffset = this.dislikeDiv.getBoundingClientRect();
            // these are relative to the viewport, i.e. the window
            var top = viewportOffset.top;
            var left = viewportOffset.left;
            div.style.top = top + this.dislikeDiv.offsetHeight + 10 + "px";
            div.style.left = left + "px";

            dislikes.forEach((like: string) => {
                let li = document.createElement("li")
                li.innerHTML = like
                ul.appendChild(li)
            })

            let timeout = setTimeout(() => {
                if (div.parentNode != undefined) {
                    div.parentNode.removeChild(div)
                }
            }, 2500)

            this.dislikeDiv.onmouseleave = () => {
                clearTimeout(timeout);
                if (div.parentNode != undefined) {
                    div.parentNode.removeChild(div)
                }
            }
        }
    }

    showLikeList() {
        let likes = (<Message>this.model).whoLikesIt()
        if (likes.length > 0 && document.getElementById((<Message>this.model).uuid + "_like_lst") == undefined) {
            // display the div.
            let div = document.createElement("div")
            div.id = (<Message>this.model).uuid + "_like_lst"
            div.style.position = "absolute"
            div.style.zIndex = "1000";
            div.style.backgroundColor = "rgba(0,0,0,0.87)";
            div.style.padding = "0px 5px 0px 5px"
            div.style.color = "white";

            let ul = document.createElement("ul")
            div.appendChild(ul)
            document.body.appendChild(div)

            var viewportOffset = this.likeDiv.getBoundingClientRect();
            // these are relative to the viewport, i.e. the window
            var top = viewportOffset.top;
            var left = viewportOffset.left;
            div.style.top = top + this.likeDiv.offsetHeight + 10 + "px";
            div.style.left = left + "px";

            likes.forEach((like: string) => {
                let li = document.createElement("li")
                li.innerHTML = like
                ul.appendChild(li)
            })

            let timeout = setTimeout(() => {
                if (div.parentNode != undefined) {
                    div.parentNode.removeChild(div)
                }
            }, 2500)

            this.likeDiv.onmouseleave = () => {
                clearTimeout(timeout);
                if (div.parentNode != undefined) {
                    div.parentNode.removeChild(div)
                }
            }
        }
    }

    /**
     * Refresh interface value from it model.
     */
    refresh() {
        this.dislikeCount.innerHTML = (<Message>this.model).howManyDislikes().toString()
        this.likeCount.innerHTML = (<Message>this.model).howManyLikes().toString()
    }
}