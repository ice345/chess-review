import { describe, expect, it } from "vitest";
import { parsePgn } from "@chess-review/chess-core";
import { divideGame, phaseForPly } from "./divider";

describe("scalachess Divider port", () => {
  it("matches the upstream KrTnOvuD compatibility range", () => {
    const game = parsePgn("1. e3 g6 2. d4 Bg7 3. Nf3 Nf6 4. Bd3 O-O 5. O-O b6 6. c4 Bb7 7. Nbd2 d5 8. b3 Nbd7 9. Bb2 Re8 10. Qc2 dxc4 11. bxc4 c5 12. d5 e5 13. e4 h5 14. a4 Nf8 15. h3 Qd6 16. Nxe5 Rxe5 17. Nf3 N6d7 18. Nxe5 Bxe5 19. Bxe5 Nxe5 20. Be2 Bc8 21. f4 Ned7 22. e5 Qe7 23. Bf3 Rb8 24. Rae1 f5 25. d6 Qh4 26. e6 Nxe6 27. Rxe6 Nf6 28. Ree1 Qxf4 29. Bd5+ Nxd5 30. Rxf4 Nxf4 31. Qd2 g5 32. d7 Bb7 33. d8=Q+ Rxd8 34. Qxd8+ Kh7 35. Qc7+ Kh6 36. Qxb7 g4 37. Qc6+ Ng6 38. Re6 gxh3 39. Rxg6+ Kh7 40. Rh6+ Kg7 41. Qf6+ Kg8 42. Rh8#");
    const division = divideGame(game);
    expect(division.middlePly).toBeGreaterThanOrEqual(18);
    expect(division.middlePly).toBeLessThanOrEqual(40);
    expect(division.endPly).toBeGreaterThanOrEqual(50);
    expect(division.endPly).toBeLessThanOrEqual(65);
  });

  it("uses board structure rather than fixed move ranges", () => {
    const game = parsePgn("1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8 4. Nf3 Nf6 5. d4 e6 6. Bd3 Be7 7. O-O O-O 8. Re1 b6 9. Ne4 Bb7 10. Nxf6+ Bxf6 11. c3 Nd7 12. Bf4 c5 13. Ne5 cxd4 14. cxd4 Nxe5 15. dxe5 Be7 16. Qc2 h6 17. Rad1 Qc8 18. Qe2 Rd8 19. Qg4 Kf8 20. Re3");
    const division = divideGame(game);
    expect(division.middlePly).toBeDefined();
    expect(division.middlePly).toBeGreaterThan(8);
    expect(division.middlePly).toBeLessThan(30);
    expect(phaseForPly(1, division)).toBe("opening");
  });

  it("finds early endgames after rapid simplification", () => {
    const game = parsePgn("1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8 4. d4 Nf6 5. Nf3 e6 6. Bd3 Be7 7. O-O O-O 8. Re1 c5 9. dxc5 Bxc5 10. Bg5 Be7 11. Qe2 Nc6 12. Rad1 Qc7 13. Ne4 Nxe4 14. Qxe4 f5 15. Qh4 Bxg5 16. Nxg5 h6 17. Nxe6 Bxe6 18. Rxe6 Rad8 19. Rde1 Nd4 20. Re7 Qd6 21. Qg3 Qxg3 22. hxg3 Rf7 23. Bc4 Rf8 24. Rxf7 Rxf7 25. Re8+ Kh7 26. Bxf7");
    const division = divideGame(game);
    expect(division.middlePly).toBeDefined();
    expect(division.endPly).toBeDefined();
    expect(division.endPly).toBeGreaterThan(division.middlePly ?? -1);
  });
});
