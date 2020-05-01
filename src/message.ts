import { randomUUID, isString } from "./utility";
import { Room, RoomView } from "./room";
import { ReplaceOneRqst, ReplaceOneRsp, UpdateOneRqst, UpdateOneRsp } from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
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

    // If the message is a reply I will keep the reference of it parent here.
    private parent: Message;

    // A message can contain replies that are also message,
    // but a replies cannot contain a reply...
    private _replies: Array<Message>;

    public get replies(): Array<Message> {
        return this._replies;
    }
    public set replies(value: Array<Message>) {
        this._replies = value;
    }

    public get uuid(): string {
        return this._id;
    }

    /**
     * Message are send by account and send on channel by the application by a given user.
     * @param from The author of message
     * @param text The message text, can by html text.
     * @param date The message date
     */
    constructor(public from: string, public text: string, public date: Date, id?: string, likes?: Array<string>, dislikes?: Array<string>, replies?: Array<any>) {
        super();

        // generate the message uuid.
        this._id = randomUUID();
        if (id != undefined && isString(id)) {
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
            replies.forEach((obj: any) => {
                // init a message from json-oject.
                let reply = this.fromObject(obj);
                reply.parent = this;
                this._replies.push(reply)
            })
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
        let parent = this.parent;
        this.parent = null;

        // cut replies view circular references.
        let views = new Array<View>();
        this.replies.forEach((reply: Message) => {
            views.push(reply.view)
            reply.view = null;
            reply.parent = null;
        })

        let str = JSON.stringify(this);

        // set back reference.
        this.parent = parent;
        this.view = view
        views.forEach((v: View, i: number) => {
            this.replies[i].setView(v)
            this.replies[i].parent = this
        })

        return str;
    }

    // Initialyse a message from an object.
    fromObject(obj: any): Message {
        let msg = new Message(obj.from, obj.text, new Date(obj.date), obj._id, obj.likes, obj.dislikes, obj._replies);
        return msg;
    }

    // Set message values from string.
    fromString(str: string) {
        let msgObj = JSON.parse(str);
        this.text = msgObj.text;
        this.from = msgObj.from;
        this.date = new Date(msgObj.date);
        this.likes = msgObj.likes;
        this.dislikes = msgObj.dislikes;
        this._replies = new Array<Message>();
        // Now the replies.
        msgObj._replies.forEach((obj: any) => {
            // init a message from json-oject.
            let reply = this.fromObject(obj);
            reply.parent = this
            this._replies.push(reply)
        })
    }

    // Reply to a particular message in the discution.
    reply(msg: Message, room: Room, callback: () => void, errorCallback: (err: any) => void) {
        this._replies.push(msg);

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
        let rqst = new UpdateOneRqst();
        rqst.setId("chitchat_db");
        rqst.setDatabase("chitchat_db");
        rqst.setCollection("Rooms");

        if(this.parent==undefined){
            rqst.setQuery(`{"_id":"${room.name}", "messages._id":"${this._id}"}`);
            rqst.setValue(`{"$set":{"messages.$":${this.toString()}}}`);
        }else{
            rqst.setQuery(`{"_id":"${room.name}", "messages._id":"${this.parent._id}"}`);
            rqst.setValue(`{"$set":{"messages.$":${this.parent.toString()}}}`);
        }

        rqst.setOptions(`[{"upsert": true}]`);

        // call persist data
        Model.globular.persistenceService
            .updateOne(rqst, {
                token: localStorage.getItem("user_token"),
                application: application,
                domain: domain
            })
            .then((rsp: UpdateOneRsp) => {
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
    private room: Room;

    /**
     * Display the message inside it parent container.
     * @param parent 
     * @param message 
     */
    constructor(parent: any, message: Message, room: Room) {

        super(message);

        // keep ref on the room.
        this.room = room;

        // keep the div in the member variable.
        this.div = document.getElementById(message.uuid);

        if (this.div == undefined) {
            // Set the icon with the message color.
            let color = room.getParticipantColor(message.from);
            let border = `border: 1px solid ${color};`

            let html = `
            <div class="row" id="${message.uuid}" name="${room.id}">
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
                        <div class="card-actions right">
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
                    <div id="${message.uuid + "_replies_div"}" class="col s11 offset-s1" style="display:none;"></div>
                    <div class="col s12" style="display: flex; justify-content: flex-end; padding-right: 25px;">
                        <a id="${message.uuid + "_reply_btn"}" href="javascript:void(0)">reply</a>
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
        }

        // Here I will display the reply...
        let msg = (<Message>this.model);
        if (msg.replies.length > 0) {
            let div = document.getElementById(message.uuid + "_replies_div")
            div.style.display = ""

            msg.replies.forEach((reply: Message) => {
                let view = new MessageView(div, reply, room);
                view.hideReplyBtn();
                view.div.style.marginBottom = "0px"
            });
        }

        // Now I will get the reference to user
        this.replyBtn = document.getElementById(message.uuid + "_reply_btn");

        this.likeDiv = document.getElementById(message.uuid + "_like_div")
        this.likeBtn = document.getElementById(message.uuid + "_like_btn");
        this.likeCount = document.getElementById(message.uuid + "_like_count");

        this.dislikeDiv = document.getElementById(message.uuid + "_dislike_div")
        this.dislikeBtn = document.getElementById(message.uuid + "_dislike_btn");
        this.dislikeCount = document.getElementById(message.uuid + "_dislike_count");

        // Now the actions.
        this.likeBtn.onmouseover = function () {
            this.style.cursor = "pointer"
        }

        this.dislikeBtn.onmouseover = function () {
            this.style.cursor = "pointer"
        }

        this.dislikeBtn.onmouseleave = function () {
            this.style.cursor = "default"
        }

        this.likeBtn.onmouseleave = function () {
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
                    this.displayMessage("Thank's man!", 3000)
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
        this.replyBtn.onclick = () => {
            this.room.setReplyTo(<Message>this.model)
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

    hide() {
        this.div.style.display = "none";
    }

    show() {
        this.div.style.display = "";
    }

    hideReplyBtn() {
        this.replyBtn.style.display = "none";
    }

    showReplyBtn() {
        this.replyBtn.style.display = "";
    }

    /**
     * Refresh interface value from it model.
     */
    refresh() {
        this.dislikeCount.innerHTML = (<Message>this.model).howManyDislikes().toString()
        this.likeCount.innerHTML = (<Message>this.model).howManyLikes().toString()
        let msg = (<Message>this.model);
        console.log(msg)
        if (msg.replies.length > 0) {
            let div = document.getElementById(msg.uuid + "_replies_div")
            div.style.display = ""
            div.innerHTML = ""
            msg.replies.forEach((reply: Message) => {
                let view = new MessageView(div, reply, this.room);
                view.hideReplyBtn();
                view.div.style.marginBottom = "0px"
            });

            this.room.view.scrollDown();
        }
    }
}