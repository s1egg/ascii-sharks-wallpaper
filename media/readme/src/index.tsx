import React from "react";
import { Composition, registerRoot } from "remotion";
import { Desktop } from "./Desktop";
import { DURATION, FPS, HEIGHT, WIDTH } from "./ocean";

const Root = () => <Composition id="MacDesktop" component={Desktop} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />;
registerRoot(Root);
