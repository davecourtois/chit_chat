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
import { RemoveRessourceRqst, Ressource } from "globular-web-client/lib/ressource/ressource_pb";
import { AttachementsPanel } from "./attachment";

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

  // List of participant, that information is keep local.
  private participants_: Array<string>;

  // List of all message of the room since it creation.
  private messages_: Array<Message>;

  // events listeners.
  private room_listener: string
  private leave_room_listener: string
  private join_room_listener: string
  private delete_room_listener: string

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
    public creator: string,
    colors: Array<any>,
    public subjects?: Array<string>,
    participants?: Array<any>
  ) {
    super();

    this._id = name;

    // Copy the list of colors.
    this.colors = [...colors]

    // Set the participant color map.
    this.participantsColor = new Map<string, Array<string>>();

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

    // Now the event.
    Room.eventHub.subscribe(
      this.name + "_join_room_channel",
      // On subscribe
      (uuid: string) => {
        // this.uuid = uuid;
        this.join_room_listener = uuid;

        Room.eventHub.subscribe(
          this.name + "_leave_room_channel",
          // On subscribe
          (uuid: string) => {
            this.leave_room_listener = uuid;
            Room.eventHub.subscribe(this.name + "_delete_room_channel",
              (uuid: string) => {
                this.delete_room_listener = uuid
              },
              (roomId: string) => {
                if (this.name == roomId) {
                  this.onDelete()
                }
              }, false)
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
        this.view.displayMessage(err, 2000);
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
        this.view.displayMessage(err, 2000);
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

  deleteChatRequest(account: Account) {
    // delete chat request associated with that room and account.
    let rqst = new persistence.DeleteRqst
    rqst.setQuery(`{"from":"${account.name}"}`)
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("PendingChatRequest");

    Model.globular.persistenceService.delete(rqst, {
      token: localStorage.getItem("user_token"),
      application: application,
      domain: domain
    })
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
          },
          // On event.
          (str: any) => {
            // init the json object
            let msg = JSON.parse(str)
            // call the local listener.
            this.onMessage(new Message(msg.from, msg.text, msg.date, msg._id, msg.likes, msg.dislikes, msg.replies_));
          },
          false
        );

        // publish the message.
        Room.eventHub.publish(this.name + "_join_room_channel", account.name, false);

        // get the list of existing message for that room and keep it locally.
        this.messages_ = new Array<Message>();

        let rqst = new persistence.FindRqst
        rqst.setId("chitchat_db");
        rqst.setDatabase("chitchat_db");
        rqst.setCollection("Rooms");
        rqst.setQuery(`{"_id":"${this.name}"}`)
        rqst.setOptions(`[{"Projection":{"_id":0, "messages":1}}]`)

        let stream = Model.globular.persistenceService.find(rqst, {
          token: localStorage.getItem("user_token"),
          application: application,
          domain: domain
        });

        stream.on("data", (rsp: persistence.FindResp) => {
          let data = JSON.parse(rsp.getJsonstr())
          let messages = data[0].messages;
          for (var i = 0; i < messages.length; i++) {
            this.appendMessage(new Message(messages[i].from, messages[i].text, new Date(messages[i].date), messages[i]._id, messages[i].likes, messages[i].dislikes, messages[i].replies_))
          }
        });

        stream.on("status", status => {
          if (status.code != 0) {
            console.log(status.details)
          }
        })

      });
    }

    // Set invitation available...
    let invitationLnks = document.getElementsByClassName("invite_contact_lnk")
    for (var i = 0; i < invitationLnks.length; i++) {
      invitationLnks[i].classList.remove("disabled")
    }

    // Set back sub-discution buttons.
    let backBtns = document.getElementsByClassName(`exit_subdiscution_btn ${this.name}`)
    for (var i = 0; i < backBtns.length; i++) {
      let backBtn = <any>backBtns[i]
      backBtn.style.display = ""
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
        Room.eventHub.publish(this.name + "_leave_room_channel", account.name, false);

        if (callback != undefined) {
          callback();
        }
      });
    }

    // Set invitation disable...
    let invitationLnks = document.getElementsByClassName("invite_contact_lnk")
    for (var i = 0; i < invitationLnks.length; i++) {
      invitationLnks[i].classList.add("disabled")
    }

    // delete subdiscution button.
    let backBtns = document.getElementsByClassName(`exit_subdiscution_btn ${this.name}`)
    for (var i = 0; i < backBtns.length; i++) {
      let backBtn = <any>backBtns[i]
      backBtn.style.display = "none"
    }

    // remove pending chat request...
    this.deleteChatRequest(account);
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
      let rqst = new persistence.UpdateOneRqst();
      rqst.setId("chitchat_db");
      rqst.setDatabase("chitchat_db");
      rqst.setCollection("Rooms");

      rqst.setQuery(`{"_id":"${this.name}"}`);
      rqst.setValue(`{"$push":{"messages":${message.toString()}}}`);

      // call persist data
      Model.globular.persistenceService
        .updateOne(rqst, {
          token: localStorage.getItem("user_token"),
          application: application,
          domain: domain
        })
        .then((rsp: persistence.UpdateOneRsp) => {
          // The message was send with success!
          Model.eventHub.publish(this.name + "_channel", message.toString(), false);
        })
        .catch((err: any) => {
          this.view.displayMessage(err, 2000)
        });
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

  delete() {
    // The first step will be to delete the room collection that contain message.
    // room collection has been deleted.
    let rqst = new persistence.DeleteOneRqst
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Rooms");
    rqst.setQuery(`{"_id":"${this.name}"}`);

    Model.globular.persistenceService.deleteOne(rqst, {
      token: localStorage.getItem("user_token"),
      application: application,
      domain: domain,
      path: `/${application}/rooms/` + this.name
    }).then(() => {
      // So here I will dispatch a message to keep all connected users up to date.
      let rqst = new persistence.DeleteRqst
      rqst.setId("chitchat_db");
      rqst.setDatabase("chitchat_db");
      rqst.setCollection("Participants");
      rqst.setQuery(`{"room":"${this.name}"}`);

      Model.globular.persistenceService.delete(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain,
        path: `/${application}/rooms/` + this.name
      }).then(() => {
        // So here I will dispatch a message to keep all connected users up to date.
        let rqst = new RemoveRessourceRqst
        let r = new Ressource
        r.setPath(`/${application}/rooms`);
        r.setSize(0);
        r.setName(this.name)
        r.setModified(Math.floor(Date.now() / 1000))
        rqst.setRessource(r)
        Model.globular.ressourceService.removeRessource(rqst, {
          token: localStorage.getItem("user_token"),
          application: application,
          domain: domain,
          path: `/${application}/rooms/` + this.name
        }).then(() => {
          Model.eventHub.publish(this.name + "_delete_room_channel", this.name, false)
        }).catch((err: any) => {
          this.view.displayMessage(err, 2000);
        })
      }).catch((err: any) => {
        this.view.displayMessage(err, 2000);
      })
    }).catch((err: any) => {
      this.view.displayMessage(err, 2000);
    })
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
    let msg = new Message(evt.from, evt.text, new Date(evt.date), evt._id, evt.likes, evt.dislikes, evt.replies_)
    this.appendMessage(msg)

    // in case the message is a reply to another message I will hide incomming message 
    // that are not releated to this message.
    if (this.replyTo != undefined) {
      let view = <MessageView>msg.getView()
      view.hide();
    }
  }

  /**
   * Close event listeners.
   */
  close() {
    // disconnect the listener to display joinning user
    Room.eventHub.unSubscribe(this.name + "_join_room_channel", this.join_room_listener)

    // disconnect the listener to display leaving user
    Room.eventHub.unSubscribe(this.name + "_leave_room_channel", this.leave_room_listener)

    // disconnect the delete room channel (local event)
    Room.eventHub.unSubscribe(this.name + "_delete_room_channel", this.delete_room_listener)
  }

  /**
   * That function was call when a room is delete.
   */
  onDelete() {

    // Delete messages.
    this.messages_.forEach((msg: Message) => {
      msg.delete() // delete local objects.
    })


    // clear the message list.
    this.messages_.splice(0, this.messages_.length)

    // remove the view from it parent. Message will be also remove there.
    this.view.element.parentNode.removeChild(this.view.element);
    this.view = null;

    // close listeners.
    this.close()
  }

  /**
   * Return the json string of the class. That will be use to save user data into the database.
   */
  toString(): string {
    let room_ = {
      _id: this._id,
      type: this.type,
      name: this.name,
      creator: this.creator,
      subjects: this.subjects,
      messages: new Array<any>()
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

  // The attachement panel.
  private attachementsPanel: AttachementsPanel

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
              <i id="${this.uuid + "_delete_btn"}" class="material-icons right" style="display: none">
                delete_forever
              </i>
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
        <div  id="${this.uuid + "_side"}" class="hide-on-small-only col m3 card-panel" style="padding: 0px;">
        </div>
    </div>
    `;

    // Initialyse the html elements.
    let range = document.createRange();
    let div = range.createContextualFragment(html);
    parent.appendChild(div)

    // keep the div in the member variable.
    this.div = document.getElementById(this.uuid);

    // exit discution button.
    let exitBtn = document.getElementById(this.uuid + "_exit_btn")

    // delete discution button.
    let deleteBtn = document.getElementById(this.uuid + "_delete_btn")

    // The body will be use to contain list of messages.
    this.body = document.getElementById(this.uuid + "_body");

    // The side panel.
    this.side = document.getElementById(this.uuid + "_side");

    // Create the attachement panel for that room and put it in the side panel.
    this.attachementsPanel = new AttachementsPanel(this.side, room);

    // The message input window.
    this.messageInput = new MessageInput(document.getElementById(this.uuid + "_message_input"), room)

    //////////////////////////////////////////////////////////////////////
    // Buttons actions
    //////////////////////////////////////////////////////////////////////
    if (this.model.creator == applicationModel.account.name) {
      deleteBtn.style.display = "" // set visible if the logged user is the creator of the discution.
    }

    deleteBtn.onmouseover = () => {
      deleteBtn.style.cursor = "pointer";
    }

    deleteBtn.onmouseleave = () => {
      deleteBtn.style.cursor = "default";
    }

    deleteBtn.onclick = () => {
      // So here I will made use of a message box to ask the use if it really want to 
      // close the discution.
      let cancel_btn_id = randomUUID()
      let delete_btn_id = randomUUID()

      let msgBox = this.displayMessage(`
      <div style="diplay: flex; flex-direction: row;">
        <div class="row">
          <div class="col s12">Do you really want to delete that discution?</div>
        </div>
        <div class="row">
          <div style="display: flex; justify-content: flex-end;">
            <a id=${cancel_btn_id} >cancel</a>
            <a id=${delete_btn_id}  style="margin-left: 10px;">delete</a>
          </div>
        </div>
      </div>`)

      // get the button and set the actions.
      let cancelBtn = <any>document.getElementById(cancel_btn_id)
      let deleteBtn = <any>document.getElementById(delete_btn_id)

      cancelBtn.onmouseover = deleteBtn.onmouseover = function () {
        this.style.cursor = "pointer"
      }

      cancelBtn.onmouseout = deleteBtn.onmouseout = function () {
        this.style.cursor = "default"
      }
      cancelBtn.onclick = () => {
        msgBox.dismiss();
      }

      deleteBtn.onclick = () => {
        // first of all I will remove the collection that contain the room message.
        this.model.delete();
        msgBox.dismiss();
      }

    }

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

  // Set the scroll to bottom of the window.
  scrollDown() {
    this.body.scrollTop = this.body.scrollHeight;
  }

  // Display the room...
  createMessageView(msg: Message) {
    // dont recreate already existing view.
    if (msg.getView() != undefined) {
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
    backBtn.className = `material-icons exit_subdiscution_btn ${this.model.name}`;
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

