import { IPluginSettingPage } from "./core/PluginCore";
import { IProjectSettings } from "./Interfaces";
import { Plugin } from "./Main";

    /* project Setting page closure*/
    export function ProjectSettingsPage():IPluginSettingPage <IProjectSettings>{
        let self: IPluginSettingPage<IProjectSettings> = {};
        
        if (window["ConfigPage"] !== undefined) {
            self = { ...Object.getPrototypeOf(new ConfigPage()) }
            self.configApp = window["configApp"];
        }

        
        self.getSettingsDOM = (settings:IProjectSettings): JQuery => {
            
            return $(`
                <div class="panel-body-v-scroll fillHeight">
                    <div id="options">
                    </div>
                </div>
                `);
        };


        self.settings = () => {
            let currentSettings = {};
            // Get the config from the configApp when in adminConfig
            if (self.configApp) {
                let filterSettings = self.configApp.getJSONProjectSettings(self.getProject(), Plugin.config.projectSettingsPage.settingName);
                if (filterSettings.length == 1)
                    currentSettings = filterSettings[0].value;
            }
            else {
                // get the config from the IC (when not in the adminConfig)
                currentSettings = IC.getSettingJSON(Plugin.config.projectSettingsPage.settingName, {});
            }
            return { ...Plugin.config.projectSettingsPage.defaultSettings, ...currentSettings }
        };
        self.renderSettingPage = () => {
            self.initPage(
                `${ Plugin.config.projectSettingsPage.title}` ,
                true,
                undefined,
                Plugin.config.projectSettingsPage.help,
                Plugin.config.projectSettingsPage.helpUrl,
                undefined
            );
            self.showSimple();
        };
        self.saveAsync = ()=> {
            return configApp.setProjectSettingAsync(self.getProject(), Plugin.config.projectSettingsPage.settingName, JSON.stringify(self.settingsChanged), configApp.getCurrentItemId());
        }
        self.getProject = () => {
            /* get the project id from the setting page */
            return configApp.getCurrentItemId().split("-")[0];
        }
        self.showAdvanced = () => {
            console.debug("Show advanced clicked");
            self.showAdvancedCode(JSON.stringify(self.settingsChanged), function (newCode: string) {
                self.settingsChanged = JSON.parse(newCode);
                self.paramChanged();
                self.renderSettingPage();
            });
        };
        self.showSimple = () => {

            self.settingsOriginal = self.settings();
            self.settingsChanged = { ...self.settingsOriginal };
            let dom = self.getSettingsDOM(self.settingsChanged);
            app.itemForm.append(dom);
            ml.UI.addCheckbox($("#options",dom), "Enabled", self.settingsChanged, "enabled",self.paramChanged);
            ml.UI.addDropdownNumber($("#options",dom), "Max item count", self.settingsChanged, "maxItemsCount", 10, 200, self.paramChanged);
        };

        self.paramChanged = () => {
            console.log("value changed!")
            configApp.itemChanged(JSON.stringify(self.settingsOriginal) != JSON.stringify(self.settingsChanged));
        }

      
        return self;
    }
