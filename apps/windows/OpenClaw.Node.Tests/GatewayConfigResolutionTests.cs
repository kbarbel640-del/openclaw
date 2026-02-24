using System.Text.Json;

namespace OpenClaw.Node.Tests;

public class GatewayConfigResolutionTests
{
    [Fact]
    public void BuildGatewayUrlFromGatewaySection_UsesDefaultHostAndPort_WhenMissing()
    {
        using var doc = JsonDocument.Parse("{\"gateway\":{}}\n");
        var gateway = doc.RootElement.GetProperty("gateway");

        var url = Program.BuildGatewayUrlFromGatewaySection(gateway, out var error);

        Assert.Null(error);
        Assert.Equal("ws://127.0.0.1:18789", url);
    }

    [Fact]
    public void BuildGatewayUrlFromGatewaySection_UsesConfiguredHostAndPort()
    {
        using var doc = JsonDocument.Parse("{\"gateway\":{\"host\":\"192.168.1.50\",\"port\":19001}}\n");
        var gateway = doc.RootElement.GetProperty("gateway");

        var url = Program.BuildGatewayUrlFromGatewaySection(gateway, out var error);

        Assert.Null(error);
        Assert.Equal("ws://192.168.1.50:19001", url);
    }

    [Fact]
    public void BuildGatewayUrlFromGatewaySection_ReturnsError_ForNonStringHost()
    {
        using var doc = JsonDocument.Parse("{\"gateway\":{\"host\":123,\"port\":18789}}\n");
        var gateway = doc.RootElement.GetProperty("gateway");

        var url = Program.BuildGatewayUrlFromGatewaySection(gateway, out var error);

        Assert.Null(url);
        Assert.Equal("gateway.host must be a string", error);
    }
}
