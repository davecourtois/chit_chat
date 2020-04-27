import { Message } from "./message";
import { Account } from "./account";
import * as M from "materialize-css";
import "materialize-css/sass/materialize.scss";
import "../css/application.css";
import "../css/room.css";

import * as persistence from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { application, domain, applicationView } from ".";
import { randomUUID } from "./utility";
import { Model } from "./model";
import { View } from "./components/view";
import { applicationModel } from "./index"

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

  // If a room is private the master can accept or refuse room access and
  // also kick out participant.
  private master_?: Account;

  // List of participant, that information is keep local.
  private participants_: Array<string>;

  // List of all message of the room since it creation.
  private messages_: Array<Message>;

  // listeners.
  private leave_room_listener: string
  private join_room_listener: string

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
    public subjects?: Array<string>,
    master?: Account,
    participants?: Array<any>
  ) {
    super();

    this._id = name;

    if (master != null) {
      this.master_ = master;
    }

    this.participants_ = new Array<string>();
    if (participants != null) {
      this.participants_ = participants;
    }

    this.messages_ = new Array<Message>();

    Room.eventHub.subscribe(
      "join_room_" + this.name + "_channel",
      // On subscribe
      (uuid: string) => {
        // this.uuid = uuid;
        this.join_room_listener = uuid;
      },
      // On event.
      (paticipantId: any) => {
        this.onJoin(paticipantId)
      },
      false
    );

    Room.eventHub.subscribe(
      "leave_room_" + this.name + "_channel",
      // On subscribe
      (uuid: string) => {
        this.leave_room_listener = uuid;
      },
      // On event.
      (paticipantId: string) => {
        this.onLeave(paticipantId)
      },
      false
    );

    Room.eventHub.subscribe(
      "logout_event",
      // On subscribe
      (uuid: string) => {

      },
      // On event.
      (userId: any) => {
        Room.eventHub.unSubscribe("join_room_" + this.name + "_channel", this.join_room_listener)
        Room.eventHub.unSubscribe("leave_room_" + this.name + "_channel", this.leave_room_listener)
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

  /**
   * Remove a participant from the room.
   * @param participant_id 
   * @param callback 
   */
  removePaticipant(participant_id: string, callback?: () => void) {
    let rqst = new persistence.DeleteRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Participants");

    rqst.setQuery(JSON.stringify({ participant: participant_id }));
    rqst.setOptions(`[]`);

    Room.globular.persistenceService
      .delete(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain
      })
      .then((rsp: persistence.DeleteRsp) => {
        // publish leave room event.
        Room.eventHub.publish("leave_room_" + this.name + "_channel", participant_id, false);

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
   * @param participant_id 
   */
  private appendParticipant(participant_id: string) {
    let rqst = new persistence.ReplaceOneRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Participants");

    let id = participant_id + "_" + this.name;
    let participant = { _id: id, participant: participant_id, room: this.name };
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
        Room.eventHub.publish("join_room_" + this.name + "_channel", participant_id, false);
      })
      .catch((err: any) => {
        console.log(err);
        let msg = JSON.parse(err.message);
        // this.view.displayMessage(msg.ErrorMsg, 2000);
      });
  }

  /**
   * Join the room.
   * @param account
   */
  join(account: Account) {
    let index = this.participants_.indexOf(account.name);
    if (index == -1) {
      // Keep track of names of paticipant in the room.
      this.appendParticipant(account.name);
    }


    // get the list of existing message for that room and keep it locally.

    // Connect the listener to display new receive message.

    // get the list of actual user in the room

    // Connect the listener to display leaving user

  }

  /**
   * Leave a room.
   * @param account
   */
  leave(account: Account) {

    // Remove the participant from the list.
    let index = this.participants_.indexOf(account.name);
    if (index != -1) {
      this.removePaticipant(account.name);
    }

    // Remove the list of messages to free ressource.

    // disconnect the listener to display new receive message.

    // disconnect the listener to display joinning user
    Room.eventHub.unSubscribe("join_room_" + this.name + "_channel", this.join_room_listener)

    // disconnect the listener to display leaving user
    Room.eventHub.unSubscribe("leave_room_" + this.name + "_channel", this.leave_room_listener)


    // publish close room if there is no more participant.
  }

  /**
   * Publish a message on that room.
   */
  publish(from: string, text: string) {
    let message = new Message(from, text, new Date());

    // publish message on the channel.
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
    }
    applicationView.displayMessage(participantId + " leave the room " + this.name, 2000)
    Room.eventHub.publish("refresh_rooms_channel", participantId, true);
  }

  /**
   * That event is receive when a message is receive for that room.
   * @param evt
   */
  onMessage(evt: any) {

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

  // layout section of the page.
  private header: any;
  private body: any;
  private footer: any;
  private index: number;

  private side: any; // Can be use to display various information...


  constructor(parent: any, room: Room, index: number) {

    super(room)

    // Set the model.
    this.model = room;
    this.uuid = randomUUID();
    this.index = index;

    let html = `
    <div id="${this.uuid}" class="row" style="padding: 0px; display: flex; flex-wrap: wrap;  min-height: calc(100vh - 56px);">
        <div class="col s12 m9" style="display: flex; flex-direction: column;">
          
          <div class="card-panel col s12" style="height: 48px; padding: 0px; margin-bottom: 0.3rem; display: flex; align-items: center; padding-left: 10px; padding-right: 10px;">
            <span style="font-size: 1.2rem;">
              ${this.model.name}
            </span>
            <span style="padding-left:10px; flex-grow: 1;">
              ${this.model.subjects}
            </span>
            <i id="${this.uuid + "_exit_btn"}" class="material-icons right">
              exit_to_app
            </i>
          </div>

          <div class="card-panel col s12" style="flex: auto;">
          </div>

        </div>
        <div class="hide-on-small-only col m3 card-panel">
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
    exitBtn.onmouseover = () => {
      exitBtn.style.cursor = "pointer";
    }

    exitBtn.onmouseleave = () => {
      exitBtn.style.cursor = "default";
    }

    exitBtn.onclick = () => {
      exitBtn.style.cursor = "default";
      this.model.removePaticipant(applicationModel.account.name, () => {
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
        instance.close(index);

      })
    }
  }

  /**
   * Return the html div.
   */
  get element(): any {
    return this.div;
  }

  setParent(parent: any) {
    parent.appendChild(this.div)

  }

  // Display the room...
  displayRoom() {
    console.log(this.model);
    // display the list of message

    // dipslay the list of participant
  }
}

