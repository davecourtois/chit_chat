import { Model } from "../model";

export class View {
 protected model:Model;

  constructor(model: Model){
    this.model = model;
    this.model.setView(this);
  }

  /**
   * Display a message to the user.
   * @param msg The message to display in toast!
   */
  displayMessage(msg: string, duration?: number) {
    M.toast({ html: msg, displayLength: duration });
  }

}
