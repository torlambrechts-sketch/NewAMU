import React, { ReactNode } from 'react';

interface DocumentsModuleLayoutProps {
    headerActions?: ReactNode;
    // other props...
}

const DocumentsModuleLayout: React.FC<DocumentsModuleLayoutProps> = ({ headerActions, ...otherProps }) => {
    return (
        <ModulePageShell
            {...otherProps}
            headerActions={headerActions} // Passing headerActions to ModulePageShell
        >
            {/* other components or children */}
        </ModulePageShell>
    );
};

export default DocumentsModuleLayout;