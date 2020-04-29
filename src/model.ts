import * as GlobularWebClient from "globular-web-client";
import { View } from "./components/view";

export class Model {

  // The parent view.
  protected view: View;

  public static globular: GlobularWebClient.Globular;
  public static eventHub: GlobularWebClient.EventHub;

  constructor(){
  }

  setView(view: View){
      this.view = view;
  }

  getView():View{
    return this.view;
  }

}
