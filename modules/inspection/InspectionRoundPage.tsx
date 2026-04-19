import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase'; 

// Utilizing the centralized design system layout tokens
import { 
  WPSTD_FORM_ROW_GRID, 
  WPSTD_FORM_FIELD_LABEL, 
  WPSTD_FORM_LEAD 
} from '../../src/components/layout/WorkplaceStandardFormPanel';

// Reusable standard input class to match the create form's visual identity
const WPSTD_FORM_INPUT = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#1a3d32] focus:border-transparent outline-none";

export const InspectionRoundPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inspectionData, setInspectionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInspection = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'inspection_rounds', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setInspectionData(docSnap.data());
        } else {
          setError("Inspection round not found.");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load data from the database.");
      } finally {
        setLoading(false);
      }
    };

    loadInspection();
  }, [id]);

  const handleUpdate = async (field: string, value: string) => {
    if (!id) return;
    try {
      const docRef = doc(db, 'inspection_rounds', id);
      await updateDoc(docRef, { [field]: value });
      setInspectionData((prev: any) => ({ ...prev, [field]: value }));
    } catch (err) {
      console.error("Error updating document: ", err);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Laster inspeksjonsrunde...</div>;
  }

  if (error || !inspectionData) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-100 mt-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{inspectionData.title || "Inspeksjonsrunde"}</h1>
        <p className={WPSTD_FORM_LEAD}>
          Administrer detaljer for denne inspeksjonsrunden. Endringer lagres automatisk.
        </p>
      </div>

      <div className="space-y-6">
        {/* Status Field */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL}>Status</label>
          <select 
            value={inspectionData.status || 'draft'}
            onChange={(e) => handleUpdate('status', e.target.value)}
            className={WPSTD_FORM_INPUT}
          >
            <option value="draft">Utkast (Draft)</option>
            <option value="active">Pågår (Active)</option>
            <option value="completed">Fullført (Completed)</option>
          </select>
        </div>

        {/* Assigned To Field */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</label>
          <input 
            type="text" 
            value={inspectionData.assigned_to || ''}
            onChange={(e) => handleUpdate('assigned_to', e.target.value)}
            className={WPSTD_FORM_INPUT}
            placeholder="Navn på ansvarlig"
          />
        </div>

        {/* Location Field */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL}>Lokasjon / Avdeling</label>
          <input 
            type="text" 
            value={inspectionData.location || ''}
            onChange={(e) => handleUpdate('location', e.target.value)}
            className={WPSTD_FORM_INPUT}
            placeholder="F.eks. Produksjonshall A"
          />
        </div>

        {/* Scheduled Date Field */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL}>Dato</label>
          <input 
            type="date" 
            value={inspectionData.scheduled_for || ''}
            onChange={(e) => handleUpdate('scheduled_for', e.target.value)}
            className={WPSTD_FORM_INPUT}
          />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
        <button 
          onClick={() => navigate('/inspections')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]"
        >
          Tilbake til oversikt
        </button>
      </div>
    </div>
  );
};

export default InspectionRoundPage;
