import { Model } from "./model";
import { View } from "./components/view";
import { randomUUID, randomIntFromInterval } from "./utility";
import { ReadDirRequest, ReadFileResponse } from "globular-web-client/lib/file/filepb/file_pb";
import { application, domain } from ".";
import { GetRessourceOwnersRqst, GetRessourceOwnersRsp, GetPermissionsRqst, GetPermissionsRsp } from "globular-web-client/lib/ressource/ressource_pb";
import { Room, RoomType } from "./room";

// Concatenate a mix of typed arrays
function concatenate(...arrays: any) {
    // Calculate byteSize from all arrays
    let size = arrays.reduce((a: any, b: any) => a + b.byteLength, 0)
    // Allcolate a new buffer
    let result = new Uint8Array(size)

    // Build the new array
    let offset = 0
    for (let arr of arrays) {
        result.set(arr, offset)
        offset += arr.byteLength
    }

    return result
}

/**
 * Display the a view of all ressource releated to a given discution
 */
export class AttachementsPanel extends View {
    // The div that contain the list of attachement.
    private div: any;
    private filesDiv: any; // The file div.
    private files: FilesModel;
    private iconFilesView: IconFilesView
    private listFilesView: ListFilesView
    private iconFilesViewBtn: any;
    private listFilesViewBtn: any;
    private parent: any;
    private room: Room;
    private uuid: string;
    private path: string;

    // Event listeners.
    private refresh_attachement_listener: string;
    private join_room_listener: string;
    private leave_room_listener: string;
    private delete_room_listener: string;

    // Attach button
    private attachBtn: any;

    constructor(parent: any, room: Room) {
        super()

        this.parent = parent;
        this.room = room;
        this.uuid = randomUUID()
        this.path = "/uploads/chitchat/" + room.name

        let html = `
            <div id="${this.uuid}">
                <nav class="nav-wrapper indigo darken-4" style="height: 48px; display: flex; align-items: center; padding-left: 10px; padding-right: 10px; color: white;">
                    <div style="display:flex; width: 100%;">
                        <span style="flex-grow: 1;" tile="Discutions you have created">Attachements</span> 
                        <i id="${this.uuid + "_picture_btn"}" class="material-icons right" style="align-self: center;">attach_file</i>
                        <input id="file_input" type="file" name="name" multiple="true" style="display: none;" />
                    </div>
                </nav>
                <div style="display: flex; width: 100%; justify-content: flex-end;">
                    <i id="${this.uuid + "_icon_view_btn"}" class="material-icons">view_module</i>
                    <i id="${this.uuid + "_list_view_btn"}" class="material-icons disabled">view_list</i>
                </div>
                <div id="${this.uuid + "_file_div"}">

                </div>
            </div>
        `
        let range = document.createRange();
        let div = range.createContextualFragment(html);
        parent.appendChild(div)

        // keep reference to the div.
        this.div = document.getElementById(this.uuid)
        this.filesDiv = document.getElementById(this.uuid + "_file_div");
        this.attachBtn = <any>document.getElementById(this.uuid + "_picture_btn");
        this.iconFilesViewBtn = <any>document.getElementById(this.uuid + "_icon_view_btn");
        this.listFilesViewBtn = <any>document.getElementById(this.uuid + "_list_view_btn");

        this.attachBtn.onmouseover = this.iconFilesViewBtn.onmouseover = this.listFilesViewBtn.onmouseover = function () {
            this.style.cursor = "pointer";
        }

        this.attachBtn.onmouseout = this.iconFilesViewBtn.onmouseout = this.listFilesViewBtn.onmouseout = function () {
            this.style.cursor = "default";
        }

        let fileInput = document.getElementById("file_input");

        // Now the button click action
        this.iconFilesViewBtn.onclick = () => {
            this.iconFilesViewBtn.classList.remove("disabled")
            this.listFilesViewBtn.classList.add("disabled")
            this.displayIconFilesView(this.files)
        }

        this.listFilesViewBtn.onclick = () => {
            this.iconFilesViewBtn.classList.add("disabled")
            this.listFilesViewBtn.classList.remove("disabled")
            this.displayListFilesView(this.files)
        }

        this.attachBtn.onclick = (e: any) => {
            fileInput.click()
        }

        fileInput.onchange = (e: any) => {

            let path = this.path;
            const fd = new FormData();

            // add all selected files
            for (var i = 0; i < e.target.files.length; i++) {
                let file = e.target.files[i];
                fd.append("multiplefiles", file, file.name);
                fd.append("path", path)
            }

            // create the request
            const xhr = new XMLHttpRequest();

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // we done! I will use the rename file event to refresh the directory...
                    Model.eventHub.publish(this.room.name + "_refresh_attachment_channel", { path: this.path }, true);
                }
            };

            // path to server would be where you'd normally post the form to
            xhr.open('POST', "/uploads", true);
            xhr.setRequestHeader("token", localStorage.getItem("user_token"))
            xhr.setRequestHeader("application", "admin")
            xhr.setRequestHeader("domain", window.location.hostname)
            xhr.onerror = (err: any) => {

            }

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {   //if complete
                    if (xhr.status === 200) {  //check if "OK" (200)
                        //success
                    } else {
                        M.toast({ html: "Permission denied to upload file " + path, displayLength: 2000 });
                    }
                }
            }

            xhr.send(fd);
        }

        // I will use event to react to action made by the user on attachement instead of 
        // references.
        Model.eventHub.subscribe(room.name + "_refresh_attachment_channel",
            (uuid: string) => {
                this.refresh_attachement_listener = uuid;
            },
            (evt: any) => {

            },
            false)

        
        // Connect the event listener's
        Model.eventHub.subscribe(
            room.name + "_join_room_channel",
            // On subscribe
            (uuid: string) => {
                // this.uuid = uuid;
                this.join_room_listener = uuid;

                Model.eventHub.subscribe(
                    room.name + "_leave_room_channel",
                    // On subscribe
                    (uuid: string) => {
                        this.leave_room_listener = uuid;
                        Model.eventHub.subscribe(room.name + "_delete_room_channel",
                            (uuid: string) => {
                                this.delete_room_listener = uuid
                            },
                            (roomId: string) => {
                                if (roomId == roomId) {
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

        // Display files from the path.
        this.displayFiles()
    }

    /**
     * I will get the list of file and display its...
     */
    displayFiles() {
        let rqst = new ReadDirRequest
        rqst.setPath(this.path)

        // I will get all infromation at once.
        rqst.setRecursive(true)
        rqst.setThumnailheight(256)
        rqst.setThumnailwidth(256)

        let stream = Model.globular.fileService.readDir(rqst, {
            token: localStorage.getItem("user_token"),
            application: application,
            domain: domain
        })

        let data = new Uint8Array()

        // Get the stream and set event on it...
        stream.on("data", (rsp: ReadFileResponse) => {
            // data = new Uint8Array([ ...data, ...rsp.getData_asU8() ]); 
            data = concatenate(data, rsp.getData_asU8())
        });

        stream.on("status", status => {
            if (status.code == 0) {
                var jsonStr = new TextDecoder("utf-8").decode(data);
                let infos = JSON.parse(jsonStr)

                // Here is the way to create object's asynchrously.

                // Create an temporary array of file with their basic informations.
                let files = new Array<File>()
                for (var i = 0; i < infos.Files.length; i++) {
                    let f = infos.Files[i]
                    let file = new File(f.Name, this.path, f.Size, f.ModTime, f.Thumbnail)
                    files.push(file)
                }

                // Now initialyse each file object.
                let initFiles = (files: Array<File>, callback?: () => void) => {
                    // pop a file from the array
                    let file = files.pop()
                    if (files.length != 0) {
                        file.init((file: File) => {
                            this.files.appendFile(file)
                            // Call the function recursively
                            initFiles(files, callback)
                        })
                    } else {
                        // called when all files are initialysed.
                        file.init((file: File) => {
                            this.files.appendFile(file)
                            // No more file to intialyse we are done so call the callback.
                            callback()
                        })
                    }
                }

                // set a new file model.
                this.files = new FilesModel(this.room)

                // Init files and display view.
                initFiles(files, () => {
                    if (!this.listFilesViewBtn.classList.contains("disabled")) {
                        this.displayListFilesView(this.files)
                    } else {
                        this.displayIconFilesView(this.files)
                    }
                })

            } else {
                // display error message.
                this.displayMessage(status.details, 3000)
            }
        })
    }

    // Display the list of files information as icons.
    displayIconFilesView(files: FilesModel) {
        if (this.iconFilesView == null) {
            this.iconFilesView = new IconFilesView(this.filesDiv, this.files)
        } else {
            this.iconFilesView.show()
        }
    }

    // Display a simple list.
    displayListFilesView(files: FilesModel) {
        if (this.listFilesView == null) {
            this.listFilesView = new ListFilesView(this.filesDiv, this.files)
        } else {
            this.listFilesView.show()
        }
    }

    /**
     * Set the parent.
     */
    setParent(parent: any) {
        this.parent = parent;
        this.show()
    }

    /**
     * Remove from the dom.
     */
    hide() {
        this.parent.removeChild(this.div)
    }

    /**
     * Re-append to the dom...
     */
    show() {
        this.parent.appendChild(this.div)
    }

    /**
     * Close the panel.
     */
    close() {
        // unsubscribe to file attachement channel.
        Model.eventHub.unSubscribe(this.room.name + "_refresh_attachment_channel", this.refresh_attachement_listener)

        // disconnect the listener to display joinning user
        Model.eventHub.unSubscribe(this.room.name + "_join_room_channel", this.join_room_listener)

        // disconnect the listener to display leaving user
        Model.eventHub.unSubscribe(this.room.name + "_leave_room_channel", this.leave_room_listener)

        // disconnect the delete room channel (local event)
        Model.eventHub.unSubscribe(this.room.name + "_delete_room_channel", this.delete_room_listener)
    }

    // Event ...
    onJoin(participant: string) {
        let div = document.getElementById(participant + "_icons_view_files_div")
        if(div != undefined){
            let color = this.room.getParticipantColor(participant)
            div.style.borderTopColor = color
        }
    }

    onLeave(participant: string) {
        let div = document.getElementById(participant + "_icons_view_files_div")
        if(div != undefined){
            div.style.borderTopColor = "#D0D0D0"
        }
    }

    onDelete() {
        // close listeners.
        this.close()
    }

}

/**
 * That class contain information of File.
 */
class File {
    private name: string
    private path: string
    private size: number
    private modified: Date
    private _owner: string;

    public get owner(): string {
        return this._owner;
    }

    public set owner(value: string) {
        this._owner = value;
    }

    private permissions: Array<any>
    private _thumbnail: string; // base64

    public get thumbnail(): string {
        return this._thumbnail;
    }
    public set thumbnail(value: string) {
        this._thumbnail = value;
    }

    constructor(name: string, path: string, size: number, modified: string, thumbnail: string) {
        this.name = name;
        this.path = path;
        this.size = size;
        this.modified = new Date(modified);
        this.thumbnail = thumbnail
    }

    // Inityalise file information like owner and permissions.
    init(callback: (file: File) => void) {

        // The first thing I will do it's to get the ressource 
        // owner.
        let rqst = new GetRessourceOwnersRqst
        rqst.setPath(this.path + "/" + this.name)

        Model.globular.ressourceService.getRessourceOwners(rqst, {
            token: localStorage.getItem("user_token"),
            application: application,
            domain: domain
        }).then((rsp: GetRessourceOwnersRsp) => {
            this.owner = rsp.getOwnersList()[0]

            // Now I will get the permission for the file.
            let rqst = new GetPermissionsRqst
            rqst.setPath(this.path + "/" + this.name)
            Model.globular.ressourceService.getPermissions(rqst, {
                token: localStorage.getItem("user_token"),
                application: application,
                domain: domain
            }).then((rsp: GetPermissionsRsp) => {
                // set the permissions.
                this.permissions = JSON.parse(rsp.getPermissions())
                callback(this)
            }).catch((err: any) => {
                console.log(err)
            })
        }).catch((err: any) => {
            console.log(err)
        })
    }
}

/**
 * This is the model of the file view.
 */
class FilesModel extends Model {
    private _files: Array<File>;
    private room: Room;

    public get files(): Array<File> {
        return this._files;
    }
    public set files(value: Array<File>) {
        this._files = value;
    }

    constructor(room: Room) {
        super()
        this.files = new Array<File>();
        this.room = room;
    }

    appendFile(file: File) {
        this.files.push(file)
    }

    getOwnerColor(owner: string):string {
        return this.room.getParticipantColor(owner)
    }
}

/**
 * Basic class for Icon File View and List File View.
 */
class FilesView extends View {
    protected parent: any;
    protected div: any;
    protected uuid: string

    constructor(parent: any, model: FilesModel) {
        super(model);
        this.uuid = randomUUID()
        this.parent = parent;

        // Reset the parent content.
        this.parent.innerHTML = "";

        // Initialyse the files.

    }

    show() {
        this.parent.innerHTML = ""
        if (this.parent != undefined) {
            this.parent.appendChild(this.div)
        }
    }

    hide() {
        this.div.parentNode.removeChild(this.div)
    }

    // Display files.
    displayFiles() {
        for (var i = 0; i < (<FilesModel>this.model).files.length; i++) {
            this.displayFile((<FilesModel>this.model).files[i])
        }
    }

    // Display a single files.
    displayFile(file: File) {

    }
}

class IconFilesView extends FilesView {

    // The icons div
    private iconsDiv: any;


    constructor(parent: any, model: FilesModel) {
        super(parent, model)

        // So here I will create the interfaces.
        let html = `
        <div id="${this.uuid}" style="display: flex; width: 100%; flex-direction: column; height: calc(100vh - 150px);">
            <div id="${this.uuid + "_icons_div"}" style="display: flex; flex-direction: column; padding: 5px; overflow-y: auto;">
            </div>
            <div  id="${this.uuid + "_permissions_div"}">
            </div>
        </div>
        `

        let range = document.createRange();
        let div = range.createContextualFragment(html);
        parent.appendChild(div)

        // Keep reference to div.
        this.div = document.getElementById(this.uuid)
        this.iconsDiv = document.getElementById(this.uuid + "_icons_div")

        this.displayFiles()
    }

    getUserDiv(id: string): any {

        // Get the existing user div.
        if(document.getElementById(id + "_icons_view_files_div")!=undefined){
            return document.getElementById(id + "_icons_view_files_div")
        }

        // get the div color.
        let color = (<FilesModel>this.model).getOwnerColor(id)

        // create a new div.
        let html = `
        <div style="display: flex; flex-direction: column; padding: 0px 5px 15px 5px;">
            <div>${id}</div>
            <div id="${id + "_icons_view_files_div"}" style="display: flex; flex-wrap: wrap; border-top: 2px solid ${color};">
            </div>
        </div>
        `
        let range = document.createRange();
        let div = range.createContextualFragment(html);

        // append the div to the icon div.
        this.iconsDiv.appendChild(div)

        // return the div in the dom.
        return document.getElementById(id + "_icons_view_files_div")
    }

    // Display a single files.
    displayFile(file: File) {
        let html = `
            <img style=" object-fit: cover; height: 87px; margin: 5px;" src="${file.thumbnail}"> </img>
        `
        let range = document.createRange();
        let img = range.createContextualFragment(html);

        // Append the image to it owner div.
        this.getUserDiv(file.owner).appendChild(img)

        console.log(file)
    }
}

class ListFilesView extends FilesView {
    constructor(parent: any, model: FilesModel) {
        super(parent, model)
        this.displayFiles()
    }

    // Display a single files.
    displayFile(file: File) {
        console.log(file)
    }
}