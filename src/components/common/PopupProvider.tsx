import React, { createContext, useCallback, useContext, useState } from 'react';
import { logger } from '../../utils/logger';
import { CustomPopup } from './CustomPopup';

interface PopupOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
}

interface PopupContextType {
  showCustomPopup: (options: PopupOptions) => void;
  hidePopup: () => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export const PopupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<PopupOptions | null>(null);

  const showCustomPopup = useCallback((opts: PopupOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const hidePopup = useCallback(() => {
    setVisible(false);
    if (options?.onCancel) options.onCancel();
  }, [options]);

  const handleConfirm = useCallback(() => {
    setVisible(false);
    if (options?.onConfirm) options.onConfirm();
  }, [options]);

  return (
    <PopupContext.Provider value={{ showCustomPopup, hidePopup }}>
      {children}
      {options && (
        <CustomPopup
          visible={visible}
          title={options.title}
          message={options.message}
          type={options.type || 'info'}
          onClose={hidePopup}
          actions={
            options.onConfirm
              ? [
                  {
                    label: options.confirmLabel || 'Confirm',
                    onPress: handleConfirm,
                  },
                ]
              : undefined
          }
        />
      )}
    </PopupContext.Provider>
  );
};

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    logger.error('PopupProvider', 'usePopup must be used within a PopupProvider');
    return {} as PopupContextType;
  }
  return context;
};
