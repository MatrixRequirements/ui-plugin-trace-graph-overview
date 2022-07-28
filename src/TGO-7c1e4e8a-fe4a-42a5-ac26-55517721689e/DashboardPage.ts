import { IProjectSettings } from "./Interfaces";
import { Plugin } from "./Main";
import { Network, DataSet, Node, Edge, IdType, Options } from 'vis';


// eslint-disable-next-line no-unused-vars
export class DashboardPage {
    settings: IProjectSettings;
    currentSelection: IReference[];
    itemSelector: ItemSelectionImpl;
    _root: JQuery<HTMLElement>;
    network: Network;
    constructor() {
        this.settings = { ...Plugin.config.projectSettingsPage.defaultSettings, ...IC.getSettingJSON(Plugin.config.projectSettingsPage.settingName, {}) } ;
    }

    private getDashboardDOM(): JQuery {
        return $(`
                <div class="panel-body-v-scroll fillHeight panel-default">
                    <div style="margin: 10px">
                        <div class="row product doNotCopy">
                            <div id="itemSelection" class="col-lg-12 col-md-5 col-md-offset-0"></div>
                        </div>
                        <div class="row" id="waitForIt">
                        </div>
                        <div id="noItems" style="display: none">Not enough data</div>
                    </div>
                    <div id="visjscontainer" class="" style="margin: 10px; height:80%;"></div>
                    </div>
                </div>
        `);
    }

        /** Add interactive element in this function */
        renderProjectPage() {
            this._root = this.getDashboardDOM();
            app.itemForm.append(
                ml.UI.getPageTitle(
                    Plugin.config.dashboard.title,
                    () => {
                        return this._root;
                    },
                    () => {
                        this.onResize();
                    }
                )
            );
            app.itemForm.append(this._root);

            const baseControl = $("#itemSelection", this._root);
            this.itemSelector = new ItemSelectionImpl(baseControl);

            const parameters = {
                prefix: "Include the following folder:",
                buttonName: "Select items",
                singleFolderOnly: false,
                //  showOnly: [this.settings.categoryName],
            };

            this.itemSelector.init({
                canEdit: true,
                controlState: ControlState.FormEdit,
                help: "",
                valueChanged: () => {
                    let title = $("#itemSelection .itemSelectionList", this._root).text();
                    if (title != undefined)
                        title =
                            Plugin.config.dashboard.title +
                            " overview for " +
                            title.replace(parameters.prefix, "");
                    else title = "Overview";
                    this.installCopyButtons(title);
                    const v = this.itemSelector.getValue();
                    const items = JSON.parse(v);
                    this.setLastSelection(items);
                    if (items != undefined)
                        this.selectionChanged(items);
                },
                parameter: parameters,
            });

            const lastSelection = this.getLastSelection();
            this.itemSelector.setValue(lastSelection.map((val) => val.to));
        }
        installCopyButtons(title: string) {
            $("i", $("#title")).remove();

            ml.UI.copyBuffer(
                $(".itemTitle", this._root),
                "copy list to clipboard",
                $("#list", this._root),
                this._root,
                (copied: JQuery) => {
                    $(".doNotCopy", copied).remove();
                    // Different if popup/Control mode
                    $(".hidden", copied).remove();

                    $("[data-attr='id']", copied).each((i, item) => {
                        $(item).text($(item).data("ref") + "!");
                    });
                }
            );
        }

        onResize() {
            /* Will be triggered when resizing. */
        }

        getItems(itemList: IReference[]): JQueryDeferred<IRestResult> {
            const itemsQueryParts = itemList.map((item) => {
                if (item.to && item.to[0] === "F") {
                    return " folderm =  " + item.to;
                } else {
                    return " id = " + item.to;
                }
            });

            const mrqlQuery = "needle?search=mrql:(" + itemsQueryParts.join(" or ") + ")&links=down,up"

            const d = restConnection.getProject(mrqlQuery);

            d.done((result: XRTrimNeedle) => {
                this.result = result;
                $("#contentPanel").show();
                $("#waitForIt").html("");

                if (result.needles.length > this.settings.maxItemsCount) {
                    ml.UI.showError("Too many items", "Please select maximum " + this.settings.maxItemsCount + " items")
                    return;
                }
                

                this.renderGraph();
            });
            return d;
        }

        renderGraph() {
            /* */
       
            const colors: IStringMap = {}

            for (const cat of IC.getCategories()) {
                const textIcon:{text:string,color:string} = <{text:string,color:string}> IC.getCategorySetting(cat, "texticon");
            
                let color = "black"
                if (textIcon && textIcon.color)
                {
                    color = textIcon.color;
                }
                colors[cat] = color;

            }

            const itemMap: IAnyMap = {};
            

            let nodeArray:Node[] = [];
            let edgeArray:Edge[] = [];
            for (const needle of this.result.needles) {
                const ref = ml.Item.parseRef(needle.itemOrFolderRef)
                const cat = ref.type;
                itemMap[ref.id] = colors[cat];

                if (needle.downLinkList) {
                    for (const downLink of needle.downLinkList) {
                        const downRef = ml.Item.parseRef(downLink.itemRef)
                        const cat = downRef.type;
                        itemMap[ref.id] = colors[cat];
                       
                        if (nodeArray.findIndex(n => n.id == downRef.id) == -1)
                             nodeArray.push({ id: downRef.id, label: downRef.id, color: itemMap[downRef.id] })
                        if( edgeArray.findIndex((edge)=> edge.from == ref.id && edge.to == downRef.id )  ==-1)
                            edgeArray.push(this.getEdge(ref, downRef,false))
                    }
                }
                if (needle.upLinkList) {
                    for (const uplink of needle.upLinkList) {
                        const upRef = ml.Item.parseRef(uplink.itemRef)
                        const cat = upRef.type;
                        itemMap[upRef.id] = colors[cat];
                     
                        if (nodeArray.findIndex(n => n.id == upRef.id) == -1)
                            nodeArray.push({ id: upRef.id, label: upRef.id, color: itemMap[upRef.id] })
                        
                        if (edgeArray.findIndex((edge) => edge.from == ref.id && edge.to == upRef.id) == -1)
                            edgeArray.push(this.getEdge(ref, upRef,true))
                    }
                }
                if( nodeArray.findIndex(n=>n.id == ref.id) == -1)
                    nodeArray.push({ id: ref.id, label: ref.id,color:itemMap[ref.id],})
            }
            // const graph = new DirectedGraph();
            const container = document.getElementById("visjscontainer") as HTMLElement;
            for (const itemId of Object.keys(itemMap)) {
            //     graph.addNode(itemId, {
            //         x: Math.random(),
            //         y: Math.random(),
            //         size: 10,
            //         label: itemId,
            //         color: itemMap[itemId],
            //         originalColor: itemMap[itemId],
            //     })
             }
            let nodes = new DataSet(nodeArray);

             


            
             let edges = new DataSet(edgeArray)
             let data = {
                nodes: nodes,
                edges: edges,
              };
            let options:Options =  {
                nodes: {
                  shape: "dot",
                    size: 15,
                    borderWidth:2,
                    shadow: {enabled:true}
                  },
                  edges: {
                      width: 1,
                      smooth: true,
                }
                  
              }
            this.network = new Network(container, data, options);
            this.network.on("click", function (params) {
                params.event = "[original event]";
                let item = this.getNodeAt(params.pointer.DOM);
                if (item)
                    ml.UI.showTooltip(item, $(params.delegateTarget), params);
                else
                    ml.UI.hideTooltip(true);
              });
              this.network.on("doubleClick", function (params) {
                params.event = "[original event]";
                 let item = this.getNodeAt(params.pointer.DOM);
                  window.open("/"+matrixSession.getProject() + "/"+item)
              });
        }   
    getEdge(ref: IItemIdParts, otherRef: IItemIdParts, isUp: boolean): Edge {
        /**graph legend:
                solid black: mandatory down trace
                dashed black: optional down trace
                solid blue-black: mandatory up trace
                dashed blue-black: optional up trace
                red: potentially missing? trace
                green: risk mitigation trace (defined in the risk configuration)
                orange: XTC trace
        */
        
        let color = "#AAAAAA";
        let rules = this.getRules();

        if( otherRef.type == "XTC")
            color = "#FFA807"
        else {
            if (isUp) {
                color= "#0000FF"
            } else {
                color= "#000000"
            }

            let rule = rules[ref.type];
            if (rule)
            {
                if ( !isUp && rule.downCan && rule.downCan.filter((downCan => downCan.indexOf(otherRef.type) != -1)).length > 0) {
                    return { from: ref.id, to: otherRef.id, arrows: "to", color: { color: color},dashes:true  };
                }
                if (isUp && rule.upCan &&  rule.upCan.filter((upCan => upCan.indexOf(otherRef.type) != -1)).length > 0) {
                    return { from: ref.id, to: otherRef.id, arrows: "to", color: { color: color},dashes:true    };
                }
            }    
        }
        return { from: ref.id, to: otherRef.id, arrows: "to", color: { color: color}  };
       
       
       
       
        
    }
     getRules():ITraceRuleArray
    {
        let rules:ITraceRuleArray = {};
         IC.getTraceConfig().rules.forEach((o:any) => {
            rules[o.category]  = {
                cat: o.category,
                upMust: o.up_rules.filter((up:any) => { return up.rule == "must_have" })
                    .map((up:any) => { return up.any_of }),
                upCan: o.up_rules.filter((up:any) => { return up.rule == "can_have" })
                    .map((up:any) => { return up.any_of }),
                downMust: o.down_rules.filter((dw:any) => { return dw.rule == "must_have" })
                    .map((down:any) => { return down.any_of }),
                downCan: o.down_rules.filter((dw:any) => { return dw.rule == "can_have" })
                    .map((down:any) => { return down.any_of })
            }
        });
        return rules;
    }
        public selectionChanged(itemList: IReference[]) {
            if (itemList == undefined) return;
            $("#Content").show();
            $("#waitForIt").html("");
            $("#waitForIt").append(ml.UI.getSpinningWait("please wait..."));
            $(".spinningWait").show();
            this.getItems(itemList);
        }

        getLastSelection(): IReference[] {
            const value = projectStorage.getItem("last" + Plugin.config.dashboard.id + "Selection");
            if (value != undefined && value != "") return JSON.parse(value);
            return undefined;
        }
        setLastSelection(sel: IReference[]) {
            const selection = JSON.stringify(sel);
            this.currentSelection = sel;
            projectStorage.setItem("last" + Plugin.config.dashboard.id + "Selection", selection);
        }
        private result: XRTrimNeedle;
}
