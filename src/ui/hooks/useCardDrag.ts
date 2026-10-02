/**
 * Ticket 165b — Card Drag & Drop gesture tracking.
 *
 * Henry, 2026-09-26: *"When I drag a card releasing it should deselect it.
 * Too often its selected then I go to change my active mingming then attack my ally."*
 *
 * Ruled:
 * 1. Click-to-select stays; releasing a DRAG deselects.
 * 2. Attacks stay aimable at your own mingming (isValidCardTarget untouched).
 *
 * Distinguishes a drag from a click via a movement threshold (~8px scaled).
 * Releasing a drag anywhere other than a successful drop deselects the card.
 * A plain click on a unit (pointerup without drag) never drops the card.
 */
import { useState, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { selectCard, selectTarget } from '../store/battleSlice';

export const CARD_DRAG_THRESHOLD_PX = 8;

export interface UseCardDragOptions {
    readonly scale?: number;
    readonly selectedCardId: string | null;
}

export function useCardDrag({ scale = 1, selectedCardId }: UseCardDragOptions) {
    const dispatch = useDispatch();

    const [isTargeting, setIsTargeting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
    const [originPoint, setOriginPoint] = useState<{ x: number; y: number } | null>(null);
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

    const dragInitiatedRef = useRef(false);
    const isTargetingRef = useRef(false);
    const isDraggingRef = useRef(false);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);

    const startDrag = useCallback((
        origin: { x: number; y: number },
        pointer?: { clientX: number; clientY: number },
    ) => {
        dragInitiatedRef.current = true;
        isTargetingRef.current = true;
        isDraggingRef.current = false;
        startPointRef.current = pointer ? { x: pointer.clientX, y: pointer.clientY } : { x: origin.x, y: origin.y };

        setIsTargeting(true);
        setIsDragging(false);
        setOriginPoint(origin);
        setDragPoint(startPointRef.current);
    }, []);

    const onPointerMove = useCallback((e: { clientX: number; clientY: number }) => {
        if (!isTargetingRef.current || !selectedCardId) return;

        setDragPoint({ x: e.clientX, y: e.clientY });

        if (startPointRef.current) {
            const dx = e.clientX - startPointRef.current.x;
            const dy = e.clientY - startPointRef.current.y;
            const dist = Math.hypot(dx, dy);
            if (dist >= CARD_DRAG_THRESHOLD_PX * scale) {
                isDraggingRef.current = true;
                setIsDragging(true);
            }
        }
    }, [selectedCardId, scale]);

    const endDrag = useCallback((dropped = false) => {
        if (!dragInitiatedRef.current && !isTargetingRef.current) return;
        const wasDragging = isDraggingRef.current;

        dragInitiatedRef.current = false;
        isDraggingRef.current = false;
        isTargetingRef.current = false;
        startPointRef.current = null;

        setIsTargeting(false);
        setIsDragging(false);
        setDragPoint(null);
        setOriginPoint(null);
        setHoveredEntityId(null);

        if (wasDragging && !dropped) {
            dispatch(selectCard(null));
            dispatch(selectTarget(null));
        }
    }, [dispatch]);

    const isDragActive = useCallback((): boolean => {
        return isDraggingRef.current || (dragInitiatedRef.current && isTargetingRef.current);
    }, []);

    return {
        isTargeting,
        isDragging,
        dragPoint,
        originPoint,
        hoveredEntityId,
        setHoveredEntityId,
        isDragActive,
        startDrag,
        onPointerMove,
        endDrag,
    };
}
