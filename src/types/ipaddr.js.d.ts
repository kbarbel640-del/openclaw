declare module "ipaddr.js" {
  type IPv4Range =
    | "unspecified"
    | "broadcast"
    | "multicast"
    | "linkLocal"
    | "loopback"
    | "carrierGradeNat"
    | "private"
    | "reserved";
  type IPv6Range =
    | "unspecified"
    | "loopback"
    | "linkLocal"
    | "uniqueLocal"
    | "ipv4Mapped"
    | "rfc6145"
    | "rfc6052"
    | "6to4"
    | "teredo";

  class IPv4 {
    static isValid(addr: string): boolean;
    static isValidFourPartDecimal(addr: string): boolean;
    static parse(addr: string): IPv4;
    octets: number[];
    kind(): "ipv4";
    range(): IPv4Range;
    match(what: IPv4 | IPv6 | [IPv4 | IPv6, number], bits?: number): boolean;
    toIPv4MappedAddress(): IPv6;
    toString(): string;
  }

  class IPv6 {
    static isValid(addr: string): boolean;
    static parse(addr: string): IPv6;
    parts: number[];
    kind(): "ipv6";
    range(): IPv6Range;
    match(what: IPv4 | IPv6 | [IPv4 | IPv6, number], bits?: number): boolean;
    isIPv4MappedAddress(): boolean;
    toIPv4Address(): IPv4;
    toString(): string;
  }

  function parse(addr: string): IPv4 | IPv6;
  function parseCIDR(mask: string): [IPv4 | IPv6, number];
  function isValid(addr: string): boolean;

  const addr: {
    IPv4: typeof IPv4;
    IPv6: typeof IPv6;
    parse: typeof parse;
    parseCIDR: typeof parseCIDR;
    isValid: typeof isValid;
  };
  export = addr;
}
