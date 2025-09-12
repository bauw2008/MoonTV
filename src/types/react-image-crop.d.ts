declare module 'react-image-crop' {
  import { ComponentType, CSSProperties, SyntheticEvent } from 'react';

  export interface Crop {
    unit?: string | '%' | 'px';
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface PercentCrop extends Crop {
    unit: '%';
  }

  export interface PixelCrop extends Crop {
    unit: 'px';
  }

  export interface ReactCropProps {
    children?: React.ReactNode;
    crop?: Crop;
    aspect?: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    keepSelection?: boolean;
    disabled?: boolean;
    locked?: boolean;
    className?: string;
    style?: CSSProperties;
    circularCrop?: boolean;
    ruleOfThirds?: boolean;
    onChange?: (crop: PixelCrop, percentCrop: PercentCrop) => void;
    onComplete?: (crop: PixelCrop, percentCrop: PercentCrop) => void;
    onDragStart?: (e: MouseEvent) => void;
    onDragEnd?: (e: MouseEvent) => void;
  }

  const ReactCrop: ComponentType<ReactCropProps>;
  export default ReactCrop;
}

declare module 'react-image-crop/dist/ReactCrop.css';
