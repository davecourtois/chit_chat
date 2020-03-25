

/**BOnjour
 * That class represent an account. Name and Email must be unique
 * on the server.
 */
export class Account {

    // The name of the account
    private _id: string;

    // The email of the account
    private email_: string;

    // The user first name.
    private firstName_: string;

    // The user last name.
    private lastName_: string;

    // The profile picture.
    private profilPicture_: string;

    // Keep list of participants for further chat.
    private contacts: Array<Account>;

    // Set to true if user data are intialyse.
    public hasData: boolean

    constructor(name:string, email: string) {
        this.email_ = email
        this._id = name
    }

    ///////////////////////////////////////////
    // Getter/Setter
    ///////////////////////////////////////////
    get email(): string {
        return this.email_;
    }

    set email(val: string){
        this.email_ = val;
    }

    get name(): string {
        return this._id;
    }

    set name(val: string) {
        this._id = val;
    } 

    get firstName(): string{
        return this.firstName_
    }

    set firstName(val: string){
        this.firstName_ = val;
    }

    get lastName(): string{
        return this.lastName_
    }

    set lastName(val: string){
        this.lastName_ = val;
    }

    get profilPicture(): string{
        return this.profilPicture_
    }

    set profilPicture(val: string){
        this.profilPicture_ = val;
    }
    
    /////////////////////////////////////////////
    // Methods
    /////////////////////////////////////////////

    /**
     * Append a new contanct in the list of contact.
     * @param contact The contact to append.
     */
    addContact(contact: Account) {
        let existing = this.contacts.find(x => x.email == this.email)
        if (existing == null) {
            this.contacts.push(contact)
        }
    }

    /**
     * Remove a contact from the list of contact.
     * @param contact The contact to remove
     */
    removeContact(contact: Account) {
        this.contacts = this.contacts.filter(obj => obj !== contact);
    }

    /**
     * Return the json string of the class. That will be use to save user data into the database.
     */
    toString():string{
        return JSON.stringify(this)
    }

}
