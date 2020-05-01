import * as GlobularWebClient from "globular-web-client";
import {
  GetConfigRequest,
  GetConfigResponse
} from "globular-web-client/lib/admin/admin_pb";

import { Room, RoomType } from "./room";
import { Account } from "./account";
import * as ressource from "globular-web-client/lib/ressource/ressource_pb";
import * as jwt from "jwt-decode";
import * as persistence from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { ApplicationView } from "./applicationView";
import { application, domain, readCsvFile } from ".";
import { Model } from "./model";

/**
 * The application principal class. It's the link between the user interface and
 * the backend.
 */
export class ApplicationModel extends Model {
  // The logged user
  public account: Account;

  // The current room
  public room: Room;

  // The session state.
  private sessionState: string;

  // Contain list of all rooms indexed by name.
  private rooms: Map<string, Room>;

  // The applciation view.
  protected view: ApplicationView;

  // The list of colors...
  protected colors: Array<any>;

  constructor(initCallback: () => void) {
    super();

    // The map of rooms.
    this.rooms = new Map<string, Room>();

    // Connect to the server.
    this.initGlobular(initCallback);
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Backend initialisation method.
  ///////////////////////////////////////////////////////////////////////////////

  /**
   * Connect with the backend.
   */
  private async initGlobular(initCallback: () => void) {
    let rsp = await this.getConfiguration();
    let config = JSON.parse(rsp.getResult());

    // init the globular object from the configuration retreived.
    Model.globular = new GlobularWebClient.Globular(config);

    // init the event hub from the object retreive.
    Model.eventHub = new GlobularWebClient.EventHub(
      Model.globular.eventService
    );


    // Here I will get the list of colors...
    readCsvFile("colorName.csv", (colors: Array<any>) => {
      // Get a list of colors with names.
      this.colors = colors;

      // Call the init callback function.
      initCallback();
    });
  }

  private getParticipants(
    callback: (resuts: Array<any>) => void,
    errorCallback: (err: any) => void
  ) {
    let database = "chitchat_db";
    let collection = "Participants";
    let rqst = new persistence.AggregateRqst();
    rqst.setId(database);
    rqst.setDatabase(database);
    rqst.setCollection(collection);
    rqst.setOptions(`[{"Projection":{"messages":0}}]`); // do not take all messages here.

    // { $group : { _id : "$author", books: { $push: "$title" } } }
    let pipeline = `[{"$group":{"_id": "$room", "participants": {"$push":"$participant"}}}]`;

    rqst.setPipeline(pipeline);

    // call persist data
    let stream = Model.globular.persistenceService.aggregate(rqst, {
      token: localStorage.getItem("user_token"),
      application: application,
      domain: domain
    });
    let results = new Array();

    // Get the stream and set event on it...
    stream.on("data", rsp => {
      results = results.concat(JSON.parse(rsp.getJsonstr()));
    });

    stream.on("status", status => {
      if (status.code == 0) {
        callback(results);
      } else {
        errorCallback({ message: status.details });
      }
    });
  }

  initRooms() {

    this.getParticipants(
      (participants: Array<any>) => {
        // List of Rooms
        let rqst = new persistence.FindRqst();
        rqst.setId("chitchat_db");
        rqst.setDatabase("chitchat_db");
        rqst.setCollection("Rooms");
        rqst.setOptions("[]")

        // retreive list of created rooms...
        rqst.setQuery(`{"creator":"${this.account.name}"}`);
        let stream = Model.globular.persistenceService.find(rqst, {
          token: localStorage.getItem("user_token"),
          application: application,
          domain: domain
        });

        var rooms = new Array<any>();

        stream.on("data", (rsp: persistence.FindResp) => {
          rooms = rooms.concat(JSON.parse(rsp.getJsonstr()));
        });

        stream.on("status", status => {
          if (status.code == 0) {
            rooms.forEach((room: any) => {
              let r: Room;
              let participants_ = participants.find(x => x._id === room.name);
              if (participants_ == undefined) {
                participants_ = new Array<string>();
              } else {
                participants_ = participants_.participants;
              }
              if (room.type == 2) {
                r = new Room(RoomType.Public, room.name, room.creator, this.colors, room.subjects, participants_);
                this.rooms.set(r.id, r);
                let keys = Array.from(this.rooms.keys());
                let index = keys.indexOf(r.id);
                this.view.appendRoom(r, index);
              } else {
                console.log("Private Room need to be implemented");
              }
            });
          }
        });
      },
      (err: any) => {
        console.log(err);
      }
    );

    // Publish a new room event.
    Model.eventHub.subscribe(
      "new_room_event",
      (uuid: string) => { },
      (evt: any) => {
        // Set the dir to display.
        // Here I must retreive the directory from the given path.
        let room = JSON.parse(evt);
        let r: Room;
        if (room.type == 2) {
          r = new Room(RoomType.Public, room.name, this.account.name, this.colors, room.subjects);
          this.rooms.set(r.id, r);
          let keys = Array.from(this.rooms.keys());
          let index = keys.indexOf(r.id);
          this.view.appendRoom(r, index);
        } else {
          console.log("Private Room need to be implemented");
        }
      },
      false
    );

  }

  /**
   * Get get the server configuration.
   */
  private async getConfiguration(): Promise<GetConfigResponse> {
    let config: any;
    config = {
      Protocol: window.location.protocol.replace(":", ""),
      Domain: window.location.hostname,
      PortHttp: parseInt(window.location.port),
      AdminPort: 10001,
      AdminProxy: 10002,
      Services: {} // empty for start.
    };

    // So here I will initilyse the server connection.
    let globular = new GlobularWebClient.Globular(config);
    let rqst = new GetConfigRequest();
    if (globular.adminService !== undefined) {
      let promise = await globular.adminService.getConfig(rqst, {
        domain: domain
      });
      return promise;
    }
    return null;
  }

  /////////////////////////////////////////////////////////////////////////////
  // Account management function
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Register a new account with the application.
   * @param name The account name
   * @param email The account email
   * @param password The account password
   */
  register(
    name: string,
    email: string,
    password: string,
    confirmPassord: string,
    onRegister: (account: Account) => void,
    onError: (err: any) => void
  ): Account {
    // Create the register request.
    let rqst = new ressource.RegisterAccountRqst();
    rqst.setPassword(password);
    rqst.setConfirmPassword(confirmPassord);
    let account = new ressource.Account();
    account.setEmail(email);
    account.setName(name);
    rqst.setAccount(account);

    // Register a new account.
    Model.globular.ressourceService
      .registerAccount(rqst)
      .then((rsp: ressource.RegisterAccountRsp) => {
        // Here I will set the token in the localstorage.
        let token = rsp.getResult();
        let decoded = jwt(token);

        // here I will save the user token and user_name in the local storage.
        localStorage.setItem("user_token", token);
        localStorage.setItem("user_name", (<any>decoded).username);
        localStorage.setItem("user_email", email);

        // Callback on login.
        this.account = new Account(name, email);
        onRegister(this.account);
      })
      .catch((err: any) => {
        console.log(err);
        let msg = JSON.parse(err.message);
        onError(msg);
      });

    return null;
  }

  /**
   * Login into the application
   * @param email
   * @param password
   */
  login(
    email: string,
    password: string,
    onLogin: (account: Account) => void,
    onError: (err: any) => void
  ) {

    let rqst = new ressource.AuthenticateRqst();
    rqst.setName(email);
    rqst.setPassword(password);
    Model.globular.ressourceService
      .authenticate(rqst)
      .then((rsp: ressource.AuthenticateRsp) => {
        // Here I will set the token in the localstorage.
        let token = rsp.getToken();
        let decoded = jwt(token);
        let userName = (<any>decoded).username;

        // here I will save the user token and user_name in the local storage.
        localStorage.setItem("user_token", token);
        localStorage.setItem("user_email", email);
        localStorage.setItem("user_name", userName);

        this.account = new Account(userName, email);

        //here I will remove the participant
        if (this.room != undefined) {
          this.room.leave(this.account)
        }

        // Retreive user data...
        this.readOneUserData(
          `{"_id":"` + userName + `"}`,
          (data: any) => {
            this.account.hasData = true;
            this.account.firstName = data["firstName_"];
            this.account.lastName = data["lastName_"];
            this.account.profilPicture = data["profilPicture_"];
            onLogin(this.account);
          },
          (err: any) => {
            onLogin(this.account);
            this.account.hasData = false;
            let msg = JSON.parse(err.message);
            onError(msg);
          }
        );

        Model.eventHub.publish("login_event", this.account.name, false);
      })
      .catch(err => {
        console.log(err);
        let msg = JSON.parse(err.message);
        onError(msg);
      });
  }

  /**
   * Close the current session explicitelty.
   */
  logout() {

    // Publish the logout event.
    if (this.room != undefined) {
      this.room.leave(this.account);
    }

    this.view.closeSession(this.account);

    Model.eventHub.publish("logout_event", this.account.name, false);

    // Set room to undefined.
    this.room = undefined;
    this.account = undefined;

  }

  /**
   *
   * @param state The session state change.
   */
  setSessionState(state: string) {
    if (this.sessionState != state) {
      // Todo publish session state change event.
    }

    // keep session state.
    this.sessionState = state;
  }

  /**
   * Refresh the token and open a new session if the token is valid.
   */
  refreshToken(
    onNewToken: (account: Account) => void,
    onError: (err: any, account: Account) => void
  ) {
    let rqst = new ressource.RefreshTokenRqst();
    let decoded = jwt(localStorage.getItem("user_token"));
    rqst.setToken(localStorage.getItem("user_token"));

    Model.globular.ressourceService
      .refreshToken(rqst)
      .then((rsp: ressource.RefreshTokenRsp) => {
        // Refresh the token at session timeout
      })
      .catch(err => {
        // remove old information in that case.
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_name");
        localStorage.removeItem("user_email");
        let msg = JSON.parse(err.message);
        onError(msg, this.account);
      });
  }

  ////////////////////////////////////////////////////////////////////////////
  // User data functions....
  ///////////////////////////////////////////////////////////////////////////

  /**
   * Save user data into the user_data collection. Insert one or replace one depending if values
   * are present in the firstName and lastName.
   */
  saveAccount(
    onSaveAccount: (account: Account) => void,
    onError: (err: any, account: Account) => void
  ) {
    let userName = this.account.name;
    let database = userName + "_db";
    let collection = "user_data";
    let data = this.account.toString();

    let rqst = new persistence.ReplaceOneRqst();
    rqst.setId(database);
    rqst.setDatabase(database);
    rqst.setCollection(collection);
    rqst.setQuery(`{"_id":"` + userName + `"}`);
    rqst.setValue(data);
    rqst.setOptions(`[{"upsert": true}]`);

    // call persist data
    Model.globular.persistenceService
      .replaceOne(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain
      })
      .then((rsp: persistence.ReplaceOneRsp) => {
        // Here I will return the value with it
        onSaveAccount(this.account);
      })
      .catch((err: any) => {
        console.log(err);
        let msg = JSON.parse(err.message);
        onError(msg, this.account);
      });
  }

  /**
   * Change the user profil picture...
   * @param dataUrl The data url of the new profile picture.
   * @param onSaveAccount The success callback
   * @param onError The error callback
   */
  changeProfilImage(
    dataUrl: string,
    onSaveAccount: (account: Account) => void,
    onError: (err: any, account: Account) => void
  ) {
    this.account.profilPicture = dataUrl;
    this.saveAccount(onSaveAccount, onError);

    // Todo publish profil image change event.
  }

  /**
   * Read user data one result at time.
   */
  readOneUserData(
    query: string,
    successCallback: (results: any) => void,
    errorCallback: (err: any) => void
  ) {
    let userName = localStorage.getItem("user_name");
    let database = userName + "_db";
    let collection = "user_data";

    let rqst = new persistence.FindOneRqst();
    rqst.setId(database);
    rqst.setDatabase(database);
    rqst.setCollection(collection);
    rqst.setQuery(query);
    rqst.setOptions("");

    // call persist data
    Model.globular.persistenceService
      .findOne(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain
      })
      .then((rsp: any) => {
        successCallback(JSON.parse(rsp.getJsonstr()));
      })
      .catch((err: any) => {
        errorCallback(err);
      });
  }

  ////////////////////////////////////////////////////////////////////////////
  // Chat specific functions.
  ////////////////////////////////////////////////////////////////////////////

  /**
   * Find a participant by it name.
   * @param name
   */
  findParticipantByName(name: string): Account {
    console.log("findParticipantByName is not implemented!");
    return null;
  }

  /**
   * Find a participant with it email.
   * @param email
   */
  findParticipantByEmail(email: string): Account {
    console.log("findParticipantByEmail is not implemented!");
    return null;
  }

  /**
   * Each room must contain a subject, that function help to find room for a given subject...
   * @param subject The subject of the room
   */
  findRoomsBySubject(subject: string): Array<Room> {
    return null;
  }

  /**
   * Create a new Room
   * @param account The room initiator
   * @param name The room name
   * @param subject The room conversation subject.
   */
  createRoom(
    name: string,
    subject: string,
    roomType: RoomType
  ) {
    let rqst = new persistence.InsertOneRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Rooms");

    let room = new Room(roomType, name, this.account.name, this.colors, [subject]);

    rqst.setJsonstr(room.toString());
    rqst.setOptions("");

    // call persist data
    Model.globular.persistenceService
      .insertOne(rqst, {
        token: localStorage.getItem("user_token"),
        application: application,
        domain: domain
      })
      .then((rsp: persistence.InsertOneRsp) => {

        // He will alse create a ressource for the room and set the accout as the ressource owner.
        let rqst = new ressource.SetRessourceRqst
        let r = new ressource.Ressource();
        let path = `/${application}/rooms`;
        r.setPath(path);
        r.setSize(0);
        r.setName(room.name)
        r.setModified(Math.floor(Date.now() / 1000))
        rqst.setRessource(r)

        Model.globular.ressourceService.setRessource(rqst, {
          token: localStorage.getItem("user_token"),
          application: application,
          domain: domain
        })
          .then(() => {
            Model.eventHub.publish("new_room_event", room.toString(), false);
          })
          .catch((err: any) => {
            this.view.displayMessage(err, 2000);
          });
      })
      .catch((err: any) => {
        this.view.displayMessage(err, 2000);
      });
  }
}
