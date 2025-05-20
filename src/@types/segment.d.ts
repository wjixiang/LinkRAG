declare module 'segment' {
  class Segment {
    useDefault(): void;
    doSegment(text: string, options: {
      simple?: boolean;
      stripPunctuation?: boolean;
    }): string[];
  }
  export = Segment;
}