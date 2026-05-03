import React from 'react';
import { useOrgSetup } from '../hooks/useOrgSetup';
import WorkplacePageHeading1 from '../components/layout/WorkplacePageHeading1';
import WorkplaceStandardFormPanel from '../components/layout/WorkplaceStandardFormPanel';
import DocumentsSettingsGenerelt from '../components/documents/settings/DocumentsSettingsGenerelt';
import DocumentsSettingsRevisjon from '../components/documents/settings/DocumentsSettingsRevisjon';
import DocumentsSettingsKvitteringer from '../components/documents/settings/DocumentsSettingsKvitteringer';
import DocumentsSettingsTilgang from '../components/documents/settings/DocumentsSettingsTilgang';
import DocumentsSettingsMaler from '../components/documents/settings/DocumentsSettingsMaler';
import DocumentsSettingsImportEksport from '../components/documents/settings/DocumentsSettingsImportEksport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { FileText, Settings, ShieldCheck, Mail, BookTemplate, DownloadCloud, History } from 'lucide-react';

const DocumentsModuleAdminPage: React.FC = () => {
  const { updateModulePayload, getModulePayload } = useOrgSetup();

  // Changed "documents_settings" to "documents" to match OrgModulePayloadKey requirements
  const settings = getModulePayload('documents') || {};

  const handleUpdateSettings = (updates: any) => {
    updateModulePayload('documents', {
      ...settings,
      ...updates
    });
  };

  return (
    <div className="space-y-6">
      <WorkplacePageHeading1 
        title="Administrasjon: Dokumentmodul" 
        description="Konfigurer felles innstillinger, revisjonsintervaller og maler for hele organisasjonen."
      />

      <Tabs defaultValue="generelt" className="w-full">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 mb-8">
          <TabsTrigger value="generelt" className="gap-2">
            <Settings className="w-4 h-4" /> Generelt
          </TabsTrigger>
          <TabsTrigger value="revisjon" className="gap-2">
            <History className="w-4 h-4" /> Revisjon
          </TabsTrigger>
          <TabsTrigger value="tilgang" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Tilgang
          </TabsTrigger>
          <TabsTrigger value="kvitteringer" className="gap-2">
            <Mail className="w-4 h-4" /> Kvitteringer
          </TabsTrigger>
          <TabsTrigger value="maler" className="gap-2">
            <BookTemplate className="w-4 h-4" /> Maler
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <DownloadCloud className="w-4 h-4" /> Import
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="generelt">
            <WorkplaceStandardFormPanel title="Generelle innstillinger">
              <DocumentsSettingsGenerelt 
                settings={settings} 
                onUpdate={handleUpdateSettings} 
              />
            </WorkplaceStandardFormPanel>
          </TabsContent>

          <TabsContent value="revisjon">
            <WorkplaceStandardFormPanel title="Revisjon og historikk">
              <DocumentsSettingsRevisjon 
                settings={settings} 
                onUpdate={handleUpdateSettings} 
              />
            </WorkplaceStandardFormPanel>
          </TabsContent>

          <TabsContent value="tilgang">
            <WorkplaceStandardFormPanel title="Tilgangsstyring">
              <DocumentsSettingsTilgang 
                settings={settings} 
                onUpdate={handleUpdateSettings} 
              />
            </WorkplaceStandardFormPanel>
          </TabsContent>

          <TabsContent value="kvitteringer">
            <WorkplaceStandardFormPanel title="Lese- og godkjenningskvitteringer">
              <DocumentsSettingsKvitteringer 
                settings={settings} 
                onUpdate={handleUpdateSettings} 
              />
            </WorkplaceStandardFormPanel>
          </TabsContent>

          <TabsContent value="maler">
            <WorkplaceStandardFormPanel title="Systemmaler">
              <DocumentsSettingsMaler 
                settings={settings} 
                onUpdate={handleUpdateSettings} 
              />
            </WorkplaceStandardFormPanel>
          </TabsContent>

          <TabsContent value="import">
            <WorkplaceStandardFormPanel title="Import og Eksport">
              <DocumentsSettingsImportEksport 
                settings={settings} 
                onUpdate={handleUpdateSettings} 
              />
            </WorkplaceStandardFormPanel>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default DocumentsModuleAdminPage;
