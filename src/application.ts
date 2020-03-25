import * as GlobularWebClient from "globular-web-client";
import {
  GetConfigRequest,
  GetConfigResponse
} from "globular-web-client/lib/admin/admin_pb";
import { Room, RoomType } from "./room";
import { Account } from "./account";
import * as M from "materialize-css";
import "materialize-css/sass/materialize.scss";
import "../css/application.css";
import { RegisterPanel } from "./components/register";
import { LoginPanel } from "./components/login";
import * as ressource from "globular-web-client/lib/ressource/ressource_pb";
import * as jwt from "jwt-decode";
import * as persistence from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { SessionPanel } from "./components/sessionPanel";
import { AccountPanel } from "./components/accountPanel";
import { CreateConnectionRqst, Connection, StoreType, OpenRqst, CloseRqst, SetItemRequest, GetItemRequest, GetItemResponse } from "globular-web-client/lib/storage/storagepb/storage_pb";
import { Uint8ToBase64, decode64 } from "./utility.js"

let application = "chitchat"

/**
 * The application principal class. It's the link between the user interface and
 * the backend.
 */
export class Application {
  // The logged user
  public account: Account;

  // The session state.
  private sessionState: string;

  // The globular client.
  private globular: GlobularWebClient.Globular;

  // Initialyse the event hub.
  private eventHub: GlobularWebClient.EventHub;

  // Contain list of all rooms indexed by name.
  private rooms: Map<string, Room>;

  // The parent view.
  private view: ApplicationView;

  constructor(view: ApplicationView, initCallback: () => void) {
    // set the view
    this.view = view;
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
    this.globular = new GlobularWebClient.Globular(config);

    // init the event hub from the object retreive.
    this.eventHub = new GlobularWebClient.EventHub(this.globular.eventService);

    // Call the init callback function.
    initCallback();
  }

  initRooms() {
    // Publish a new room event.
    this.eventHub.subscribe(
      "new_room_event",
      (uuid: string) => { },
      (evt: any) => {
        // Set the dir to display.
        // Here I must retreive the directory from the given path.
        let room = JSON.parse(evt);
        let r: Room;
        if (room.type == 2) {
          r = new Room(null, RoomType.Public, room.name, room.subjects, null);
          this.rooms.set(r.id, r);
          this.view.appendRoom(r);
        } else {
          console.log("Private Room need to be implemented");
        }
        console.log(room);
      },
      false
    );

    // List of Rooms
    let rqst = new persistence.FindRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Rooms");
    rqst.setQuery("{}");
    let stream = this.globular.persistenceService.find(rqst, {
      token: localStorage.getItem("application"), application: application
    });

    var rooms = new Array<any>();

    stream.on("data", (rsp: persistence.FindResp) => {
      rooms = rooms.concat(JSON.parse(rsp.getJsonstr()))
    });

    stream.on("status", status => {
      if (status.code == 0) {
        rooms.forEach((room: any) => {
          let r: Room;
          if (room.type == 2) {
            r = new Room(null, RoomType.Public, room.name, room.subjects, null);
            this.rooms.set(r.id, r);
            this.view.appendRoom(r);
          } else {
            console.log("Private Room need to be implemented");
          }
        });
      }
    });

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
      let promise = await globular.adminService.getConfig(rqst);
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
    this.globular.ressourceService
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

        // Refresh the token at session timeout
        setTimeout(() => {
          this.refreshToken((account: Account) => {
            console.log(decoded);
            console.log("refresh the token for ", account.name);
          }, onError);
        }, this.globular.config.SessionTimeout.valueOf()); // 1 second before token expire.
      })
      .catch((err: any) => {
        console.log(err);
        let msg = JSON.parse(err.message);
        onError(msg);
      });

    return null;
  }

  /**
   * A combination of storage service and ressource service. You can 
   * store an object and give access permission to it in the admin.
   * @param path The path of the ressource to be store
   * @param name The name (id) of the object to store.
   * @param object The object to store.
   */
  setStorageObject(path: string, name: string, object: any) {
    // The object will be save in the storage service...
    let rqst = new SetItemRequest
    rqst.setId(this.account.name);
    rqst.setKey(path + "/" + name);
    let objJsonB64 = Buffer.from(JSON.stringify(object)).toString("base64");
    rqst.setValue(objJsonB64); // set the base64 object
    // Save the object...
    this.globular.storageService.setItem(rqst, { "token": localStorage.getItem("user_token"), "path": path + "/" + name, applicaiton: application })
      .then(() => {
        // Now I will create a ressource to manage access the newly create object...
        let rqst = new ressource.SetRessourceRqst
        let r = new ressource.Ressource
        r.setName(name)
        r.setPath(path)
        r.setModified(Date.now())

        // Set the size of the data 
        r.setSize(4 * Math.ceil((objJsonB64.length / 3)))
        rqst.setRessource(r)

        this.globular.ressourceService.setRessource(rqst, { "token": localStorage.getItem("user_token"), applicaiton: application })
          .then(() => {
            console.log("item and ressource for ", path, name, "was saved!")
            // Test read it back...
            this.getStorageObject(path, name, (object: any) => {
              console.log("---> retreived object: ", object)
            }, (err: any) => {
              console.log(err)
            })
          }).catch(err => {
            console.log(err);
          });
      }).catch(err => {
        console.log(err);
      });
  }

  /**
   * Retreive object from storage service. 
   * @param path The path of the ressource.
   * @param name The name (id) of the object to retreive
   * @param callback In case of a susscess the object will be in the oject parameter of the callback
   * @param errorCallback In case of error the error will be in the err parameter of the callback
   */
  getStorageObject(path: string, name: string, callback: (object: any) => void, errorCallback: (err: any) => void) {
    let rqst = new GetItemRequest
    rqst.setId(this.account.name) // the connection id
    rqst.setKey(path + "/" + name)
    this.globular.storageService.getItem(rqst, { "token": localStorage.getItem("user_token"), "path": path + "/" + name, applicaiton: application })
      .then((rsp: GetItemResponse) => {
        // get back the object store from setStorageObject.
        var str64 = Uint8ToBase64(rsp.getResult())
        var jsonStr = decode64(str64)
        var obj = JSON.parse(jsonStr)
        callback(obj)
      }).catch(err => {
        errorCallback(err)
      });
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
    this.globular.ressourceService
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

        // Create A connection with the storage service.
        let rqst = new CreateConnectionRqst
        let conn = new Connection
        conn.setId(this.account.name)
        conn.setName(this.account.name)
        conn.setType(StoreType.LEVEL_DB)
        rqst.setConnection(conn)

        this.globular.storageService.createConnection(rqst, { "token": token, "application": application })
          .then(() => {
            let rqst = new OpenRqst
            rqst.setId(this.account.name)
            let path = "/home/dave/Documents/chitchat_storage_db"

            //let path = "C:/temp/chitchat_storage_db"
            // The path can vary depending on the sytem...
            let options = { path: path, name: this.account.name }
            rqst.setOptions(JSON.stringify(options));
            this.globular.storageService.open(rqst, { "token": token, "application": application })
              .then(() => {
                console.log("---> storage connection ready to be use!")
                // Test save token in the storage service.
                this.setStorageObject("/" + application + "_ressources/" + this.account.name, "token", decoded)
              })
              .catch(err => {
                console.log(err);
                let msg = JSON.parse(err.message);
                onError(msg);
              });

          }).catch(err => {
            console.log(err);
            let msg = JSON.parse(err.message);
            onError(msg);
          });

        // Refresh the token at session timeout
        setTimeout(() => {
          this.refreshToken((account: Account) => {
            console.log(decoded);
            console.log("refresh the token for ", account.name);
          }, onError);
        }, this.globular.config.SessionTimeout.valueOf()); // 1 second before token expire.

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
    // erase the local storage items.
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");

    // Publish the logout event.
    this.view.closeSession(this.account);
    let rqst = new CloseRqst

    rqst.setId(this.account.name)
    this.globular.storageService.close(rqst, { token: localStorage.getItem("user_token"), application: application })
      .then(() => {
        console.log("storage connection close!")
      }).catch((err: any) => {
        console.log(err)
      })

    // set the account to null.
    this.account = null;

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

    this.globular.ressourceService
      .refreshToken(rqst)
      .then((rsp: ressource.RefreshTokenRsp) => {

        // Here I will set the token in the localstorage.
        let token = rsp.getToken();
        let decoded = jwt(token);
        let userName = (<any>decoded).username;

        // here I will save the user token and user_name in the local storage.
        localStorage.setItem("user_token", token);
        localStorage.setItem("user_name", userName);

        // Callback on login.
        this.account = new Account(
          (<any>decoded).username,
          localStorage.getItem("user_email")
        );

        // Retreive user data...
        this.readOneUserData(
          `{"_id":"` + userName + `"}`,
          (data: any) => {
            // Callback on login.
            this.account.hasData = true;
            this.account.firstName = data["firstName_"];
            this.account.lastName = data["lastName_"];
            this.account.profilPicture = data["profilPicture_"];
            onNewToken(this.account);
          },
          (err: any) => {
            onNewToken(this.account);
            this.account.hasData = false;
            console.log(err);
            let msg = JSON.parse(err.message);
            onError(msg, this.account);
          }
        );

        // Refresh the token at session timeout
        setTimeout(() => {
          this.refreshToken((account: Account) => {
            console.log(decoded);
            console.log("refresh the token for ", account.name);
          }, onError);
        }, this.globular.config.SessionTimeout.valueOf()); // 1 second before token expire.

      })
      .catch(err => {
        console.log(err);
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
    this.globular.persistenceService
      .replaceOne(rqst, { token: localStorage.getItem("application"), application: application })
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
    this.globular.persistenceService
      .findOne(rqst, { token: localStorage.getItem("application"), application: application })
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
    account: Account,
    name: string,
    subject: string,
    roomType: RoomType
  ) {
    let rqst = new persistence.InsertOneRqst();
    rqst.setId("chitchat_db");
    rqst.setDatabase("chitchat_db");
    rqst.setCollection("Rooms");

    let room = new Room(null, roomType, name, [subject], account);
    rqst.setJsonstr(room.toString());
    rqst.setOptions("");

    // call persist data
    this.globular.persistenceService
      .insertOne(rqst, { token: localStorage.getItem("application"), application: application })
      .then((rsp: persistence.InsertOneRsp) => {
        this.eventHub.publish("new_room_event", room.toString(), false);
      })
      .catch((err: any) => {
        console.log(err);
        let msg = JSON.parse(err.message);
        this.view.displayMessage(msg.ErrorMsg, 2000);
      });
  }

  ///////////////////////////////////////////////////////////////////////
  // Network events.
  ///////////////////////////////////////////////////////////////////////

  /**
   * Event receive when a new room is created.
   * @param evt
   */
  onNewRoom(evt: any) {
    // On new room event.
  }
}

/**
 * The main user interface.
 */
export class ApplicationView {
  private model: Application;

  constructor() {
    // Set the model.
    this.model = new Application(this, () => {
      // Login automatically if the user set remember-me checkbox.
      let rememberMe = localStorage.getItem("remember-me");
      if (rememberMe) {
        // Here I will renew the last token...
        this.model.refreshToken(
          (account: Account) => {
            this.openSession(account);
          },
          (err: any, account: Account) => {
            this.displayMessage(err.ErrorMsg, 2000);
            // close the session if no token are available.
            this.closeSession(account);
          }
        );
      }
    });

    // The basic layout.
    document.body.innerHTML = `    
        <input type="file" id="profil_picture_selector" style="display: none;"/>
        <header id="header">
            <ul id="main_sidenav" class="sidenav sidenav-fixed" style="display: none">
            
            </ul>
        </header>

        <main>
            <div id="main" class="section no-pad-bot">
                <div id="workspace" class="container">
                </div>
            </div>
        </main>
        `;


    // The navigation bar at top of the application...
    let navBarCode = `
        <div class="navbar-fixed">
            <nav id="main_nav">
                <div class="nav-wrapper indigo darken-4">
                    <!--  Side menu button  -->
                    <a id="main_sidenav_lnk" href="javascript:void(0)" data-target="main_sidenav" class="sidenav-trigger" style="display: none"><i class="material-icons">menu</i></a>

                    <!-- Applicaiton logo -->
                    <a href="javascript:void(0)" class="brand-logo" style="padding-left: 20px;"><img width="24" src="speech-bubbles.svg"></img></a>

                    <!-- Medium and Up navigation menu  this is a comment-->
                    <ul id="nav-mobile" class="right hide-on-med-and-down">
                        <li id="register_lnk_0"><a class="waves-effect waves-indigo" href="javascript:void(0)">REGISTER</a></li>
                        <li id="login_lnk_0"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGIN</a></li>
                        <li id="logout_lnk_0" style="display: none"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGOUT</a></li>
                    </ul>
            
                    <!-- Small navigation menu -->
                    <a class='right dropdown-trigger hide-on-large-only' href='#' data-target='nav-mobile-dropdown'><i class="material-icons">arrow_drop_down</i></a>
                    <ul id='nav-mobile-dropdown' class='dropdown-content'">
                        <li id="register_lnk_1"><a class="waves-effect waves-indigo" href="javascript:void(0)">REGISTER</a></li>
                        <li id="login_lnk_1"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGIN</a></li>
                        <li id="logout_lnk_1" style="display: none"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGOUT</a></li>
                    </ul>
                </div>
            </nav>
        </div>
        `;

    // Append the navbar to the applicaiton interface.
    let navBar = document.createRange().createContextualFragment(navBarCode);
    document.getElementById("header").appendChild(navBar);

    // Initialyse materialyze component

    // Set the side nav.
    M.Sidenav.init(document.querySelectorAll(".sidenav"), {
      inDuration: 350,
      outDuration: 350,
      edge: "left" //or right
    });

    // Set drop-downs
    M.Dropdown.init(document.querySelectorAll(".dropdown-trigger"), {
      constrainWidth: false
    });

    // Set the media image
    M.Materialbox.init(document.querySelectorAll(".materialboxed"));

    // Connect user interface events.

    // The register button.
    document.getElementById("register_lnk_0").onclick = document.getElementById(
      "register_lnk_1"
    ).onclick = () => {

      document.getElementById("workspace").innerHTML = "";
      let registerPanel = new RegisterPanel();
      document.getElementById("workspace").appendChild(registerPanel.element);
      registerPanel.focus();

      // Set the login action handler.
      registerPanel.onLoginHandler = () => {
        document.getElementById("login_lnk_0").click();
      };

      // Now the register action.
      registerPanel.onRegisterHandler = () => {
        // Register a new account.
        this.model.register(
          registerPanel.userName,
          registerPanel.email,
          registerPanel.password,
          registerPanel.confirmPassword,
          (account: Account) => {
            this.openSession(account);
          },
          (err: any) => {
            this.displayMessage(err.ErrorMsg, 2000);
          }
        );
      };
    };

    // The login button.
    document.getElementById("login_lnk_0").onclick = document.getElementById(
      "login_lnk_1"
    ).onclick = () => {
      document.getElementById("workspace").innerHTML = "";
      let loginPanel = new LoginPanel();
      document.getElementById("workspace").appendChild(loginPanel.element);
      loginPanel.focus();

      // Set the register action handler.
      loginPanel.onRegisterHandler = () => {
        document.getElementById("register_lnk_0").click();
      };

      loginPanel.onLoginHandler = () => {
        this.model.login(
          loginPanel.email,
          loginPanel.password,
          (account: Account) => {
            this.openSession(account);
          },
          (err: any) => {
            this.displayMessage(err.ErrorMsg, 2000);
          }
        );
      };
    };

    // The logout button.
    document.getElementById("logout_lnk_0").onclick = document.getElementById(
      "logout_lnk_1"
    ).onclick = () => {
      this.model.logout();
    };
  }

  /**
   * Display a message to the user.
   * @param msg The message to display in toast!
   */
  displayMessage(msg: string, duration?: number) {
    M.toast({ html: msg, displayLength: duration });
  }

  /**
   * Open a new session.
   */
  openSession(account: Account) {
    this.displayMessage("Welcome to chitchat " + account.name + "!", 2000);

    // hide register and login menu
    document.getElementById("login_lnk_0").style.display = "none";
    document.getElementById("login_lnk_1").style.display = "none";
    document.getElementById("register_lnk_0").style.display = "none";
    document.getElementById("register_lnk_1").style.display = "none";
    // display logout menu.
    document.getElementById("logout_lnk_0").style.display = "";
    document.getElementById("logout_lnk_1").style.display = "";
    // display the sidenave menu
    document.getElementById("main_sidenav").style.display = "";
    document.getElementById("main_sidenav_lnk").style.display = "";

    // Clear the workspace.
    document.getElementById("workspace").innerHTML = "";

    // Clear the sidenav bar.
    document.getElementById("main_sidenav").innerHTML = "";

    // The session specific menu.
    let sidenav = document.getElementById("main_sidenav");

    // append the session state panel.
    let sessionPanel = new SessionPanel(
      this.model.account.name,
      this.model.account.profilPicture
    );
    sidenav.appendChild(sessionPanel.element);

    sessionPanel.setSessionName(account.name);

    let applicationMenu = document.createElement("ul");
    applicationMenu.className = "collapsible collapsible-accordion";
    applicationMenu.innerHTML = `
        <li>
            <a data-target="modal1" class="modal-trigger" style="display:none;"  id="modal_trigger"></a>
            <a class="collapsible-header waves-effect waves-teal" tabindex="0"><div style="display:flex;"><span style="flex-grow: 1;">Rooms</span> <i id="add_room_btn" class="material-icons">add_circle</i></div></a>
            <div class="collapsible-body" style="">
                <ul id="roomList">
                </ul>
            </div>
        </li>
        `;
    sidenav.appendChild(applicationMenu);
    M.Collapsible.init(applicationMenu);

    let modal = document.createElement("div");
    modal.className = "modal open";
    modal.id = "modal1";
    modal.style.maxWidth = "550px";
    modal.innerHTML = `<div class="modal-content">
    <div class="row">
       <div class="col s4">
          Room Name:
       </div>
       <div class="col s8">
          <div class="input-field inline">
             <input id="room_name_input" type="text">       
             <span></span>
          </div>
       </div>
    </div>
    <div class="row">
       <div class="col s4">
          Subject:
       </div>
       <div class="col s8">
          <div class="input-field inline">
             <input id="room_subject_input" type="text">       
             <span></span>
          </div>
       </div>
    </div>
    <div class="row">
       <div class="col s4">
          Room type:
       </div>
       <div class="col s8">
          <p>
             <label>
             <input id="room_type_public" name="group1" type="radio" checked />
             <span>Public</span>
             </label>
          </p>
          <p>
             <label>
             <input name="group1" type="radio"  />
             <span>Private</span>
             </label>
          </p>
       </div>
    </div>
 </div>
 <div class="modal-footer">
    <a id="room_create_btn" class="modal-close waves-effect waves-green btn-flat">Create</a>        
 </div>`;

    document.body.appendChild(modal);
    M.Modal.init(modal, {});
    //Connect add room action
    let add_room_btn = document.getElementById("add_room_btn");
    let room_create_btn = document.getElementById("room_create_btn");

    add_room_btn.onclick = (event: any) => {
      event.stopPropagation();
      document.getElementById("modal_trigger").click();
    };

    room_create_btn.onclick = () => {
      let roomName = (<any>document.getElementById("room_name_input")).value;
      let roomSubject = (<any>document.getElementById("room_subject_input"))
        .value;
      let roomType = (<any>document.getElementById("room_type_public")).checked;

      if (roomType) {
        this.model.createRoom(
          this.model.account,
          roomName,
          roomSubject,
          RoomType.Public
        );
      } else {
        this.model.createRoom(
          this.model.account,
          roomName,
          roomSubject,
          RoomType.Private
        );
      }
    };

    // Set the new session state.
    sessionPanel.onStateChange = (state: string) => {
      this.model.setSessionState(state);
    };

    // Display account panel to change accont setting.
    sessionPanel.onNameClick = () => {
      // Clear the workspace.
      document.getElementById("workspace").innerHTML = "";

      let accountPanel = new AccountPanel(
        this.model.account.name,
        this.model.account.firstName,
        this.model.account.lastName,
        this.model.account.email,
        this.model.account.profilPicture
      );
      document.getElementById("workspace").appendChild(accountPanel.element);

      // Here I will connect acount panel events.
      accountPanel.onSave = (
        firstName: string,
        lastName: string,
        email: string
      ) => {
        // Set the mode account properties.
        this.model.account.firstName = firstName;
        this.model.account.lastName = lastName;
        this.model.account.email = email;

        // Save the account in the user database.
        this.model.saveAccount(
          (account: Account) => {
            this.displayMessage(
              "Account " + account.name + " was saved!",
              2000
            );
          },
          (err: any) => {
            this.displayMessage(err.ErrorMsg, 2000);
          }
        );
      };

      M.updateTextFields();
    };

    // The profile image selection.
    document.getElementById("profil_picture_selector").onchange = (
      evt: any
    ) => {
      var r = new FileReader();
      var file = evt.target.files[0];
      r.onload = () => {
        // we have the file data
        // first of all I will set the already open image with the new profil image.
        let images = document.getElementsByName("profil_picture");
        for (var i = 0; i < images.length; i++) {
          images[i].setAttribute("src", r.result.toString());
        }

        // Save the profile picture.
        this.model.changeProfilImage(
          r.result.toString(),
          (account: Account) => {
            let message = `
                            <img width=30 height=30 style="margin-right: 10px" src=${account.profilPicture}></img><span>Profile image was update<span>
                        `;
            this.displayMessage(message, 2000);
          },
          (err: any) => {
            this.displayMessage(err.ErrorMsg, 2000);
          }
        );
      };
      r.readAsDataURL(file); // read as BASE64 format
    };

    // Set drop-downs
    M.Dropdown.init(document.querySelectorAll(".dropdown-trigger"), {
      constrainWidth: false
    });

    this.model.initRooms();
  }

  closeSession(account: Account) {
    // remove remember-me value.
    localStorage.removeItem("remember-me");

    // hide register and login menu
    document.getElementById("login_lnk_0").style.display = "";
    document.getElementById("login_lnk_1").style.display = "";
    document.getElementById("register_lnk_0").style.display = "";
    document.getElementById("register_lnk_1").style.display = "";
    // display logout menu.
    document.getElementById("logout_lnk_0").style.display = "none";
    document.getElementById("logout_lnk_1").style.display = "none";
    // display the sidenave menu
    document.getElementById("main_sidenav").style.display = "none";
    document.getElementById("main_sidenav_lnk").style.display = "none";

    // Clear the workspace.
    document.getElementById("workspace").innerHTML = "";

    // Clear the sidenav bar.
    document.getElementById("main_sidenav").innerHTML = "";

    // Display goodbye message.
    if (account != undefined) {
      this.displayMessage("Goodbye " + account.name + " see you latter!", 2000);
    }
  }

  appendRoom(room: Room) {
    let roomList = document.getElementById("roomList");
    let txt = `
    <li><a href="navbar.html">${room.name}</a></li>
    `;
    let elements = document.createRange().createContextualFragment(txt);
    roomList.appendChild(elements);
  }
}
