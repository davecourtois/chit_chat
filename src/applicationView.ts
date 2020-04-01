import { Room, RoomType, RoomView } from "./room";
import { Account } from "./account";
import * as M from "materialize-css";
import "materialize-css/sass/materialize.scss";
import "../css/application.css";

// Components
import { RegisterPanel } from "./components/register";
import { LoginPanel } from "./components/login";
import { SessionPanel } from "./components/sessionPanel";
import { AccountPanel } from "./components/accountPanel";
import { ApplicationModel } from "./applicationModel";
import { randomUUID } from "./utility";
import { View } from "./components/view";

/**
 * The main user interface.
 */
export class ApplicationView extends View {
    // reference to the underlying mode.
    protected model: ApplicationModel;

    constructor(model: ApplicationModel) {
        // call the view constructor here.
        super(model);

        // The basic layout.
        document.body.innerHTML = `    
        <input type="file" id="profil_picture_selector" style="display: none;"/>
        <header id="header">
            <ul id="main_sidenav" class="sidenav sidenav-fixed" style="display: none">
            
            </ul>
        </header>

        <main>
            <div id="main" class="section no-pad-bot">
                <div id="workspace" class="container"></div>
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
                    <a href="javascript:void(0)" class="brand-logo" style="padding-left: 20px;"><img width="24" src="img/speech-bubbles.svg"></img></a>

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
            document.getElementsByTagName(
                "main"
            )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

            let registerPanel = new RegisterPanel();
            document
                .getElementById("main")
                .parentNode.appendChild(registerPanel.element);
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
            document.getElementsByTagName(
                "main"
            )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

            let loginPanel = new LoginPanel();
            document
                .getElementById("main")
                .parentNode.appendChild(loginPanel.element);
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

        // Clear the main panel.
        document.getElementsByTagName(
            "main"
        )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

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
        let roomsList = M.Collapsible.init(applicationMenu);
        roomsList.open(0);

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
        document.getElementById(
            "main"
        ).innerHTML = `<div id="workspace" class="container"></div>`;

        // Clear the sidenav bar.
        document.getElementById("main_sidenav").innerHTML = "";

        // Display goodbye message.
        if (account != undefined) {
            this.displayMessage("Goodbye " + account.name + " see you latter!", 2000);
        }
    }

    appendRoom(room: Room) {
        let roomList = document.getElementById("roomList");
        let uuid = randomUUID();
        let txt = `
    <li><a id="${uuid}" href="javascript:void(0)">${room.name}</a></li>
    `;
        let elements = document.createRange().createContextualFragment(txt);
        roomList.appendChild(elements);

        document.getElementById(uuid).onclick = () => {
            if (this.model.room != undefined) {
                this.model.room.removePaticipant(this.model.account.name, () => {
                    // The user join the room.
                    room.join(this.model.account);
                    this.model.room = room;
                    let roomView = new RoomView(room);
                    // Remove the actual content
                    document.getElementById("workspace").innerHTML = "";

                    // display the room content.
                    document.getElementById("workspace").appendChild(roomView.element);
                });
            } else {
                room.join(this.model.account);
                this.model.room = room;
                let roomView = new RoomView(room);
                // display the room content.
                document.getElementById("workspace").appendChild(roomView.element);
            }
        };
    }
}
