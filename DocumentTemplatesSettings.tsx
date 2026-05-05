import React from 'react';
import { DocumentsModuleLayout } from './DocumentsModuleLayout';

const DocumentTemplatesSettings = () => {
    return (
        <DocumentsModuleLayout
            headerActions={(
                <button className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
                    Legg til mal
                </button>
            )}
        >
            {/* Your form components go here */}
        </DocumentsModuleLayout>
    );
};

export default DocumentTemplatesSettings;