"use client";

import { useEffect, useState } from "react";
import type { PieceRenderObject } from "react-chessboard";
import { APP_SETTINGS_EVENT, DEFAULT_APP_SETTINGS, loadAppSettings } from "../lib/app-settings";
import { chessboardPieces } from "../lib/board-pieces";

export function useBoardPieces(): PieceRenderObject {
  const [pieces, setPieces] = useState<PieceRenderObject>(() => chessboardPieces(DEFAULT_APP_SETTINGS.pieceSet));
  useEffect(() => {
    const sync = () => setPieces(chessboardPieces(loadAppSettings().pieceSet));
    sync();
    window.addEventListener(APP_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(APP_SETTINGS_EVENT, sync);
  }, []);
  return pieces;
}
