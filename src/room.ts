import { Message } from "./message";
import { Account } from "./account";

import * as GlobularWebClient from "globular-web-client";
import * as persistence from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { application, domain } from ".";
import { randomUUID } from "./utility";

export enum RoomType {
  Private = 1,
  Public
}

/**
 * A chat room is a virtual place where participant have conversation.
 * The room can be private or public. The room exist until all participant
 * left. At that moment the room and all message it contain is remove.
 */
export class Room {
  private view: RoomView;
  public static globular: GlobularWebClient.Globular;

  private _id: string;

  // If a room is private the master can accept or refuse room access and
  // also kick out participant.
  private master_?: Account;

  // List of participant, that information is keep local.
  private participants_: Array<Account>;

  // List of all message of the room since it creation.
  private messages_: Array<Message>;

  /**
   * Create a room instance. The room is not necessarly a new room on the network.
   * @param type  Can be private or public.
   * @param name The name of the room.
   * @param subjects List of subject discuss on that room can bu empty.
   */
  constructor(
    globular: GlobularWebClient.Globular,
    view: RoomView,
    public type: RoomType,
    public name: string,
    public subjects?: Array<string>,
    master?: Account
  ) {

    this.view = view;
    this._id = name;
    Room.globular = globular;
    

    if (master != null) {
      this.master_ = master;
    }

    this.participants_ = new Array<Account>();
    this.messages_ = new Array<Message>();
  }

  get id(): string {
    return this._id;
  }

  /**
   * Join the room.
   * @param account
   */
  join(account: Account) {
    let index = this.participants_.indexOf(account);
    if (index == -1) {
      this.participants_.push(account);
    }

    this.appendParticipant(account.name);

    // get the list of existing message for that room and keep it locally.

    // Connect the listener to display new receive message.

    // get the list of actual user in the room

    // Connect the listener to display joinning user

    // Connect the listener to display leaving user

    // Publish join room event

  }

  private getParticipants(){

  }

  static removePaticipant(participant_id: string, callback? :()=>void){
    let rqst = new persistence.DeleteRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Participants");

    
    rqst.setQuery(JSON.stringify({participant:participant_id}))  
    rqst.setOptions(`[]`);


    Room.globular.persistenceService
    .delete(rqst, { token: localStorage.getItem("user_token"), application: application, domain:domain })
    .then((rsp: persistence.DeleteRsp) => {
      // this.eventHub.publish("new_room_event", room.toString(), false);
      if(callback!=undefined){
        callback();
      }
    })
    .catch((err: any) => {
      console.log(err);
      // let msg = JSON.parse(err.message);
      // this.view.displayMessage(msg.ErrorMsg, 2000);
      if(callback!=undefined){
        callback()
      }
    });

  }

  private appendParticipant(participant_id: string){
    
    let rqst = new persistence.ReplaceOneRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Participants");

    let id = participant_id + "_" + this.name
    let participant = {_id: id, "participant":participant_id, room:this.name}
    rqst.setQuery(JSON.stringify({_id:id}))
    rqst.setValue(JSON.stringify(participant))
    rqst.setOptions(`[{"upsert":true}]`);

    // call persist data
    Room.globular.persistenceService
      .replaceOne(rqst, { token: localStorage.getItem("user_token"), application: application, domain:domain })
      .then((rsp: persistence.ReplaceOneRsp) => {
        // this.eventHub.publish("new_room_event", room.toString(), false);
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
    let index = this.participants_.indexOf(account);
    if (index == -1) {
      this.participants_ = this.participants_.splice(index, 1);

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
  onJoin(evt: any) { }

  /**
   * That event is receive when a participant leave the room.
   * @param evt
   */
  onLeave(evt: any) { }

  /**
   * That event is receive when a message is receive for that room.
   * @param evt
   */
  onMessage(evt: any) { }

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
export class RoomView {
  private model: Room;
  private div: any;

  constructor(room: Room) {
    // Set the model.
    this.model = room;

    let html = `
    <div id="user_login" class="row" style="margin:7.5px;">
        <div class="col s12 card-panel">
          Ceci est la room ${this.model.name}
        </div>
    </div>
    `
    // Initialyse the html elements.
    let range = document.createRange()
    this.div = range.createContextualFragment(html);
  }

  /**
 * Return the html div.
 */
  get element(): any {
    return this.div
  }


  // Display the room...
  displayRoom() {
    console.log(this.model)
    // display the list of message

    // dipslay the list of participant


  }
}
