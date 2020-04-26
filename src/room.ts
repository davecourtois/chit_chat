import { Message } from "./message";
import { Account } from "./account";
import * as M from "materialize-css";
import "materialize-css/sass/materialize.scss";
import "../css/application.css";

import * as GlobularWebClient from "globular-web-client";
import * as persistence from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { application, domain, applicationView } from ".";
import { randomUUID } from "./utility";
import { Model } from "./model";
import { View } from "./components/view";

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
    if(participants != null){
      this.participants_=participants;
    }

    this.messages_ = new Array<Message>();

     let uuid_join_room_listener: string
     Room.eventHub.subscribe(
      "join_room_" + this.name + "_channel",
      // On subscribe
      (uuid: string) => {
        // this.uuid = uuid;
        uuid_join_room_listener = uuid;
      },
      // On event.
      (paticipantId: any) => {
        this.onJoin(paticipantId)
      },
      false
    );

    let uuid_leave_room_listener: string
    Room.eventHub.subscribe(
      "leave_room_" + this.name + "_channel",
      // On subscribe
      (uuid: string) => {
        uuid_leave_room_listener = uuid;
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
        Room.eventHub.unSubscribe("join_room_" + this.name + "_channel", uuid_join_room_listener)
        Room.eventHub.unSubscribe("leave_room_" + this.name + "_channel", uuid_leave_room_listener)
      },
      false
    );
  }

  get id(): string {
    return this._id;
  }

  get participants() : Array<string> {

    return this.participants_;

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

    // Publish join room event
  }

 

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
        
        Room.eventHub.publish("leave_room_" + this.name + "_channel", participant_id, false);
        if (callback != undefined) {
          
          callback();
        }
      })
      .catch((err: any) => {
        console.log(err);
        // let msg = JSON.parse(err.message);
        // this.view.displayMessage(msg.ErrorMsg, 2000);
        if (callback != undefined) {
          callback();
        }
      });
  }

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
        // 
       Room.eventHub.publish("join_room_" + this.name + "_channel", participant_id , false); 
      })
      .catch((err: any) => {
        console.log(err);
        let msg = JSON.parse(err.message);
        // this.view.displayMessage(msg.ErrorMsg, 2000);
      });
  }

  /**
   * Leave a room.
   * @param account
   */
  leave(account: Account) {
    let index = this.participants_.indexOf(account.name);
    if (index != -1) {
      this.removePaticipant(account.name);
    }

    // Remove the list of messages to free ressource.

    // disconnect the listener to display new receive message.

    // disconnect the listener to display joinning user

    // disconnect the listener to display leaving user

    // publish leave room event.

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
    if(index ==-1){
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
    if(index!=-1){
       this.participants_.splice(index, 1);
    }
    applicationView.displayMessage(participantId + " leave the room " + this.name, 2000)
    Room.eventHub.publish("refresh_rooms_channel", participantId, true);
  }

  /**
   * That event is receive when a message is receive for that room.
   * @param evt
   */
  onMessage(evt: any) {}

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
export class RoomView  extends View{
  protected model: Room;
  private div: any;

  constructor(room: Room) {

    super(room)

    // Set the model.
    this.model = room;

    let html = `
    <div id="user_login" class="row" style="margin:7.5px;">
        <div class="col s12 card-panel">
          Ceci est la room ${this.model.name}
        </div>
    </div>
    `;
    // Initialyse the html elements.
    let range = document.createRange();
    this.div = range.createContextualFragment(html);
  }

  /**
   * Return the html div.
   */
  get element(): any {
    return this.div;
  }

  setParent(parent: any){
    parent.appendChild(this.div)
  }

  // Display the room...
  displayRoom() {
    console.log(this.model);
    // display the list of message

    // dipslay the list of participant
  }
}

