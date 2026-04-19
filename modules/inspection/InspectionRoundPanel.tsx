import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { CheckCircle2, Circle, Pencil, Trash2, X } from 'lucide-react';

import { 
  WPSTD_FORM_ROW_GRID, 
  WPSTD_FORM_FIELD_LABEL, 
  WPSTD_FORM_LEAD 
} from '../../src/components/layout/WorkplaceStandardFormPanel';

const WPSTD_FORM_INPUT = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#1a3d32] focus:border-transparent outline-none";

interface InspectionRoundPanelProps {
  inspectionId: string;
  onClose: () => void;
}

export const InspectionRoundPanel: React.FC<InspectionRoundPanelProps> = ({ inspectionId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [panelData, setPanelData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPanelData = async () => {
      if (!inspectionId) return;
      try {
        const docRef = doc(db, 'inspection_rounds', inspectionId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setPanelData(docSnap.data());
        } else {
          setError("Inspection round details could not be found.");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch data from the database.");
      } finally {
        setLoading(false);
      }
    };

    fetchPanelData();
  }, [inspectionId]);

  const handleFieldChange = async (field: string, value: string) => {
    try {
      const docRef = doc(db, 'inspection_rounds', inspectionId);
      await updateDoc(docRef, { [field]: value });
      setPanelData((prev: any) => ({ ...prev, [field]: value }));
    } catch (err) {
      console.error("Database update failed: ", err);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl p-6 flex items-center justify-center border-l border-gray-200 z-50">
        <p className="text-sm text-gray-500">Laster paneldata...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-200 z-50 transform transition-transform duration-300 ease-in-out">
      {/* Panel Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900">
          Rediger Inspeksjon
        </h2>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Panel Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        <div>
          <p className={WPSTD_FORM_LEAD}>
            Oppdater detaljene for denne inspeksjonsrunden direkte. Endringer lagres automatisk til databasen.
          </p>
        </div>

        <div className="space-y-5">
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL}>Tittel</label>
            <input 
              type="text" 
              value={panelData?.title || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className={WPSTD_FORM_INPUT}
              placeholder="F.eks. Månedlig Vernerunde"
            />
          </div>

          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL}>Status</label>
            <select 
              value={panelData?.status || 'draft'}
              onChange={(e) => handleFieldChange('status', e.target.value)}
              className={WPSTD_FORM_INPUT}
            >
              <option value="draft">Utkast</option>
              <option value="active">Aktiv</option>
              <option value="completed">Fullført</option>
            </select>
          </div>

          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL}>Lokasjon</label>
            <input 
              type="text" 
              value={panelData?.location || ''}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              className={WPSTD_FORM_INPUT}
              placeholder="Velg lokasjon"
            />
          </div>

          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</label>
            <input 
              type="text" 
              value={panelData?.assigned_to || ''}
              onChange={(e) => handleFieldChange('assigned_to', e.target.value)}
              className={WPSTD_FORM_INPUT}
            />
          </div>

          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL}>Gjennomføringsdato</label>
            <input 
              type="date" 
              value={panelData?.scheduled_for || ''}
              onChange={(e) => handleFieldChange('scheduled_for', e.target.value)}
              className={WPSTD_FORM_INPUT}
            />
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <label className={WPSTD_FORM_FIELD_LABEL}>Sjekkliste-elementer</label>
          <div className="mt-3 bg-gray-50 border border-gray-100 rounded-md p-4 text-center">
            <p className="text-sm text-gray-500">
              For å endre sjekkliste-spørsmålene, naviger til Mal-editoren.
            </p>
          </div>
        </div>

      </div>

      {/* Panel Footer */}
      <div className="p-6 border-t border-gray-100 bg-white">
        <button 
          onClick={onClose}
          className="w-full bg-[#1a3d32] text-white py-2.5 px-4 rounded-md font-medium text-sm hover:bg-[#142e26] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a3d32]"
        >
          Lukk Panel
        </button>
      </div>
    </div>
  );
};

export default InspectionRoundPanel;
