import { Message, MessageView } from "./message";
import { Account } from "./account";
import * as M from "materialize-css";
import "materialize-css/sass/materialize.scss";
import "../css/application.css";
import "../css/room.css";

import * as persistence from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { application, domain, applicationView } from ".";
import { randomUUID, randomIntFromInterval, fireResize } from "./utility";
import { Model } from "./model";
import { View } from "./components/view";
import { applicationModel } from "./index"
import { MessageInput } from "./components/messageInput";

export enum RoomType {
  Private = 1,
  Public
}

/**
 * A chat room is a virtual place where participant have conversation.
 * The room can be private or public. The room exist until all participant
 * left. At that moment the room and all message it contain is remove.
 */
export class Room extends Model {
  private _id: string;

  // A list of color to give to each participant of the room.
  private colors: Array<any>;

  // Keep track of the participant colors inside the room...
  // * The array contain the color name at index 0 and the color hexa value at index 1
  private participantsColor: Map<string, Array<string>>;

  // If a room is private the master can accept or refuse room access and
  // also kick out participant.
  private master_?: Account;

  // List of participant, that information is keep local.
  private participants_: Array<string>;

  // List of all message of the room since it creation.
  private messages_: Array<Message>;

  // events listeners.
  private room_listener: string
  private leave_room_listener: string
  private join_room_listener: string

  // in case the message is a reply to another message.
  private replyTo: Message;

  // The reference to the room view.
  public view: RoomView;

  /**
   * Create a room instance. The room is not necessarly a new room on the network.
   * @param type  Can be private or public.
   * @param name The name of the room.
   * @param subjects List of subject discuss on that room can bu empty.
   */
  constructor(
    public type: RoomType,
    public name: string,
    colors: Array<any>,
    public subjects?: Array<string>,
    master?: Account,
    participants?: Array<any>
  ) {
    super();

    this._id = name;

    // Copy the list of colors.
    this.colors = [...colors]
    // Set the participant color map.
    this.participantsColor = new Map<string, Array<string>>();

    if (master != null) {
      this.master_ = master;
    }

    this.participants_ = new Array<string>();
    if (participants != null) {

      // remove previous logged session if the some left in the db.
      let index = participants.indexOf(applicationModel.account.name)
      if (index != -1) {
        participants.splice(index, 1)
      }

      // Here I will give a participant a distinct color
      participants.forEach((participantId: string) => {
        let color = this.colors.splice(randomIntFromInterval(0, this.colors.length - 1), 1)[0];
        this.participantsColor.set(participantId, color)
      })

      this.participants_ = participants;
    }

    this.messages_ = new Array<Message>();
  }

  get id(): string {
    return this._id;
  }

  get participants(): Array<string> {
    return this.participants_;
  }

  get messages(): Array<Message> {
    return this.messages_;
  }

  /**
   * Take the participant id and return it accociated color.
   * @param participantId The color accociated with the participant.
   */
  getParticipantColor(participantId: string): string {
    if (this.participantsColor.has(participantId)) {
      return this.participantsColor.get(participantId)[1]
    }
    // retunr neutral grey color if the user is no more in the room...
    return "#D0D0D0"
  }

  /**
   * Remove a participant from the room.
   * @param participantId 
   * @param callback 
   */
  removePaticipant(participantId: string, callback: () => void) {


    let rqst = new persistence.DeleteRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Participants");

    rqst.setQuery(JSON.stringify({ participant: participantId }));
    rqst.setOptions(`[]`);

    Room.globular.persistenceService
      .delete(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain
      })
      .then((rsp: persistence.DeleteRsp) => {

        // call the callback if it's define.
        if (callback != undefined) {
          callback();
        }

      })
      .catch((err: any) => {
        let msg = JSON.parse(err.message);
        this.view.displayMessage(msg.ErrorMsg, 2000);
      });
  }

  /**
   * Append a participant into the room.
   * @param participantId 
   */
  private appendParticipant(participantId: string, callback: () => void) {
    let index = this.participants_.indexOf(participantId);
    if (index == -1) {
      this.participants_.push(participantId);
      // Here I will give a participant a distinct color
      let color = this.colors.splice(randomIntFromInterval(0, this.colors.length - 1), 1)[0];
      this.participantsColor.set(participantId, color)
    }

    let rqst = new persistence.ReplaceOneRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Participants");

    let id = participantId + "_" + this.name;
    let participant = { _id: id, participant: participantId, room: this.name };
    rqst.setQuery(JSON.stringify({ _id: id }));
    rqst.setValue(JSON.stringify(participant));
    rqst.setOptions(`[{"upsert":true}]`);

    // call persist data
    Room.globular.persistenceService
      .replaceOne(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain
      })
      .then((rsp: persistence.ReplaceOneRsp) => {
        // Publish join room event
        if (callback != undefined) {
          callback();
        }
      })
      .catch((err: any) => {
        console.log(err);
        let msg = JSON.parse(err.message);
        // this.view.displayMessage(msg.ErrorMsg, 2000);
      });
  }

  /**
   * Append a message into the list of room message.
   * @param message 
   */
  appendMessage(msg: Message) {
    this.view.createMessageView(msg)
    this.messages_.push(msg)
  }

  /**
   * Set it to reply to a given message.
   * @param message 
   */
  setReplyTo(msg: Message) {
    this.replyTo = msg;
    this.view.setReplyTo(msg)
  }

  /**
   * Reset the reply to message.
   */
  resetReplyTo() {
    this.replyTo = null;
  }

  /**
   * Join the room.
   * @param account
   */
  join(account: Account) {
    // join the room only fi it not already in.
    let index = this.participants_.indexOf(account.name);
    if (index == -1) {
      // Keep track of names of paticipant in the room.
      this.appendParticipant(account.name, () => {

        // Connect the listener to display new receive message.
        Room.eventHub.subscribe(
          this.name + "_channel",
          // On subscribe
          (uuid: string) => {
            this.room_listener = uuid;
            Room.eventHub.subscribe(
              "join_room_" + this.name + "_channel",
              // On subscribe
              (uuid: string) => {
                // this.uuid = uuid;
                this.join_room_listener = uuid;

                Room.eventHub.subscribe(
                  "leave_room_" + this.name + "_channel",
                  // On subscribe
                  (uuid: string) => {
                    this.leave_room_listener = uuid;

                    // publish the message.
                    Room.eventHub.publish("join_room_" + this.name + "_channel", account.name, false);

                  },
                  // On event.
                  (paticipantId: string) => {
                    this.onLeave(paticipantId)
                  },
                  false
                );
              },
              // On event.
              (paticipantId: any) => {
                this.onJoin(paticipantId)
              },
              false
            );
          },
          // On event.
          (str: any) => {
            // init the json object
            let msg = JSON.parse(str)

            // call the local listener.
            this.onMessage(new Message(msg.from, msg.text, msg.date, msg._id, msg.likes, msg.dislikes, msg._replies));
          },
          false
        );


        // get the list of existing message for that room and keep it locally.
        if (this.messages_.length == 0) {
          let rqst = new persistence.FindRqst
          rqst.setId("chitchat_db");
          rqst.setDatabase("chitchat_db");
          rqst.setCollection(this.name);
          rqst.setQuery("{}")
          let stream = Model.globular.persistenceService.find(rqst, {
            token: localStorage.getItem("user_token"),
            application: application,
            domain: domain
          });

          stream.on("data", (rsp: persistence.FindResp) => {
            let messages = JSON.parse(rsp.getJsonstr())
            for (var i = 0; i < messages.length; i++) {
              this.appendMessage(new Message(messages[i].from, messages[i].text, new Date(messages[i].date), messages[i]._id, messages[i].likes, messages[i].dislikes, messages[i]._replies))
            }
          });

          stream.on("status", status => {
            if (status.code != 0) {
              console.log(status.details)
            }
          })
        }
      });

    }
  }

  /**
   * Leave a room.
   * @param account
   */
  leave(account: Account, callback?: () => void) {

    // Remove the participant from the list.
    let index = this.participants_.indexOf(account.name);
    if (index != -1) {
      this.removePaticipant(account.name, () => {

        // publish leave room event. * The listener's will be deconnect in event handler function
        // after the publish event is received.
        Room.eventHub.publish("leave_room_" + this.name + "_channel", account.name, false);

        if (callback != undefined) {
          callback();
        }
      });
    }

    // publish close room if there is no more participant.
  }

  /**
   * Publish a message/reply on that room.
   */
  publish(from: string, text: string) {
    let message = new Message(from, text, new Date(), randomUUID());
    // If the message is a reply...
    if (this.replyTo == null) {
      // So here I will append the message inside the room database and when it'done I will send the
      // object on the room event channel.
      let rqst = new persistence.InsertOneRqst
      rqst.setId("chitchat_db");
      rqst.setDatabase("chitchat_db");
      rqst.setCollection(this.name); // Each room will have it own collection. so it will simplify query to manage it.
      rqst.setJsonstr(JSON.stringify(message));

      Model.globular.persistenceService.insertOne(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain
      }).then(() => {

        // The message was send with success!
        Model.eventHub.publish(this.name + "_channel", message.toString(), false);

      }).catch((err: any) => {
        this.view.displayMessage(err.ErrorMsg, 2000)
      })
    } else {
      this.replyTo.reply(message, this,
        () => {
          // Nothing here...
        },
        (err: any) => {
          this.view.displayMessage(err.ErrorMsg, 2000)
        })
    }

  }

  ///////////////////////////////////////////////////////////////////////
  // Network events.
  ///////////////////////////////////////////////////////////////////////

  /**
   * That event is receive when a participant join the room
   * @param evt
   */
  onJoin(participantId: string) {
    applicationView.displayMessage(participantId + " join the room " + this.name, 2000)
    let index = this.participants_.indexOf(participantId);

    if (index == -1) {
      this.participants_.push(participantId);
      // Here I will give a participant a distinct color
      let color = this.colors.splice(randomIntFromInterval(0, this.colors.length - 1), 1)[0];
      this.participantsColor.set(participantId, color)
    }

    // I will set all the icon grey...
    let icons = document.getElementsByName(participantId + "_ico")
    let color = this.getParticipantColor(participantId);
    for (var i = 0; i < icons.length; i++) {
      icons[i].style.color = color;
    }

    let messageBoxs = document.getElementsByName(participantId + "_message_box")
    for (var i = 0; i < messageBoxs.length; i++) {
      messageBoxs[i].style.border = `1px solid ${color}`;
    }

    Room.eventHub.publish("refresh_rooms_channel", participantId, true);

  }

  /**
   * That event is receive when a participant leave the room.
   * @param evt
   */
  onLeave(participantId: string) {
    let index = this.participants_.indexOf(participantId);
    if (index != -1) {
      this.participants_.splice(index, 1);
      applicationView.displayMessage(participantId + " leave the room " + this.name, 2000)

      // if it's the local user I will also disconnect the room event listener's
      let leave = applicationModel.account == undefined;
      if (!leave) {
        leave = applicationModel.account.name == participantId
      }

      if (leave) {
        // disconnect the listener to display new receive message.
        Room.eventHub.unSubscribe(this.name + "_channel", this.room_listener)

        // disconnect the listener to display joinning user
        Room.eventHub.unSubscribe("join_room_" + this.name + "_channel", this.join_room_listener)

        // disconnect the listener to display leaving user
        Room.eventHub.unSubscribe("leave_room_" + this.name + "_channel", this.leave_room_listener)
      }

      // push back it color to the array of colors.
      if (this.participantsColor.has(participantId)) {
        let color = this.participantsColor.get(participantId)
        this.colors.push(color)
      }

      // I will set all the icon grey...
      let icons = document.getElementsByName(participantId + "_ico")
      for (var i = 0; i < icons.length; i++) {
        // Here I will set the icon to grey.
        icons[i].style.color = "#D0D0D0"
      }

      let messageBoxs = document.getElementsByName(participantId + "_message_box")
      for (var i = 0; i < messageBoxs.length; i++) {
        messageBoxs[i].style.border = `1px solid #D0D0D0`;
      }

      Room.eventHub.publish("refresh_rooms_channel", participantId, true);
    }

  }

  /**
   * That event is receive when a message is receive for that room.
   * @param evt
   */
  onMessage(evt: any) {
    let msg = new Message(evt.from, evt.text, new Date(evt.date), evt._id, evt.likes, evt.dislikes, evt._replies)
    this.appendMessage(msg)

    // in case the message is a reply to another message I will hide incomming message 
    // that are not releated to this message.
    if(this.replyTo != undefined){
      let view = <MessageView> msg.getView()
      view.hide();
    }
  }

  /**
   * Return the json string of the class. That will be use to save user data into the database.
   */
  toString(): string {
    let room_ = {
      _id: this._id,
      type: this.type,
      name: this.name,
      subjects: this.subjects
    };
    return JSON.stringify(room_);
  }
}

/**
 * The user interface for a room.
 */
export class RoomView extends View {
  protected model: Room;
  private div: any;
  private uuid: string;
  private index: number; // the index in the roomList element.

  // layout section of the page.
  private body: any;
  private side: any; // Can be use to display various information...

  // The message input.
  private messageInput: MessageInput;

  constructor(parent: any, room: Room, index: number) {

    super(room)

    // Set the model.
    this.model = room;
    this.uuid = randomUUID();
    this.index = index;

    let html = `
    <div id="${this.uuid}" class="row" style="padding: 0px; display: flex; flex-wrap: wrap;  min-height: calc(100vh - 56px);">
        <div class="col s12 m9" style="display: flex; flex-direction: column; margin-top: 8px;">
          
          <div class="col s12" style="padding: 0px; margin: 0px;">
            <nav class="nav-wrapper indigo darken-4" style="height: 48px; display: flex; align-items: center; padding-left: 10px; padding-right: 10px; color: white;">
              <span style="font-size: 1.2rem;">
                ${this.model.name}
              </span>
              <span style="padding-left:10px; flex-grow: 1;">
                ${this.model.subjects}
              </span>
              <i id="${this.uuid + "_exit_btn"}" class="material-icons right">
                exit_to_app
              </i>
            </nav>
          </div>

          <div id="${this.uuid + "_body"}" class="col s12" style="flex: auto; margin: 0px; max-height: calc(100vh - 278px);overflow-y: auto; position: relative;">
           
          </div>

          <div id="${this.uuid + "_message_input"}" class="col s12" style="padding: 0px; margin: 0px;">
          </div>

        </div>
        <div  id="${this.uuid + "_side"}" class="hide-on-small-only col m3 card-panel">
        </div>
    </div>
    `;

    // Initialyse the html elements.
    let range = document.createRange();
    let div = range.createContextualFragment(html);
    parent.appendChild(div)

    // keep the div in the member variable.
    this.div = document.getElementById(this.uuid);

    let exitBtn = document.getElementById(this.uuid + "_exit_btn")

    // The body will be use to contain list of messages.
    this.body = document.getElementById(this.uuid + "_body");

    // The side panel.
    this.side = document.getElementById(this.uuid + "_side");

    // The message input window.
    this.messageInput = new MessageInput(document.getElementById(this.uuid + "_message_input"), room)

    //////////////////////////////////////////////////////////////////////
    // Buttons actions
    //////////////////////////////////////////////////////////////////////
    exitBtn.onmouseover = () => {
      exitBtn.style.cursor = "pointer";
    }

    exitBtn.onmouseleave = () => {
      exitBtn.style.cursor = "default";
    }

    exitBtn.onclick = () => {
      exitBtn.style.cursor = "default";
      this.model.leave(applicationModel.account, () => {
        document.getElementById("workspace").innerHTML = "";
        // display all join room buttons
        let btns = document.getElementsByName("join_btn")
        btns.forEach((btn: any) => {
          btn.style.display = "";
        })

        // reset the actual room 
        applicationModel.room = undefined;

        // close the actual room user list.
        var instance = M.Collapsible.getInstance(document.getElementById("roomList"));
        instance.close(this.index);

      })
    }
  }

  /**
   * Return the html div.
   */
  get element(): any {
    this.scrollDown()
    return this.div;
  }

  setParent(parent: any) {
    parent.appendChild(this.div)
    this.scrollDown()

  }

  scrollDown() {
    this.body.scrollTop = this.body.scrollHeight;
  }

  // Display the room...
  createMessageView(msg: Message) {
    // dont recreate already existing view.
    if(msg.getView() != undefined){
      return
    }

    // Append the message view into the message body
    let view = new MessageView(this.body, msg, this.model);
    msg.setView(view)
    this.scrollDown();
  }

  // Mask the window.
  setReplyTo(msg: Message) {

    // Hide the reply btn.
    (<MessageView>msg.getView()).hideReplyBtn()

    // Here I will display only the message that we want to reply...
    this.model.messages.forEach((msg: Message) => {
      document.getElementById(msg.uuid).style.display = "none";
    });

    // Here I will append the back arrow to get back in the main conversation.
    let backBtn = document.createElement("i");
    backBtn.className = "material-icons";
    backBtn.innerHTML = "arrow_back";
    backBtn.style.position = "absolute";
    backBtn.style.zIndex = "1000";
    document.body.appendChild(backBtn)

    let msgDiv = document.getElementById(msg.uuid)
    msgDiv.style.display = "";

    // Keep the event listener in the object itself.
    backBtn.onresize = () => {
      var viewportOffset = this.body.getBoundingClientRect();
      // these are relative to the viewport, i.e. the window
      var top = viewportOffset.top;
      var left = viewportOffset.left;
      backBtn.style.top = top + (this.body.offsetHeight - backBtn.offsetHeight) / 2 + "px";
      backBtn.style.left = left - backBtn.offsetWidth - 10 + "px";
    }

    // get back to normal.
    backBtn.onclick = () => {
      // Here I will display only the message that we want to reply...
      this.model.messages.forEach((msg: Message) => {
        document.getElementById(msg.uuid).style.display = "";
      });

      this.model.resetReplyTo();
      window.removeEventListener('resize', backBtn.onresize);

      // remove the button.
      backBtn.parentNode.removeChild(backBtn);
      this.messageInput.focus();
      (<MessageView>msg.getView()).showReplyBtn()
    }

    backBtn.onmouseover = () => {
      backBtn.style.cursor = "pointer"
    }

    backBtn.onmouseout = () => {
      backBtn.style.cursor = "default"
    }

    window.addEventListener('resize', backBtn.onresize)

    fireResize();

    this.messageInput.focus();

  }
}

