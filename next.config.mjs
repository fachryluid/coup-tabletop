const tunnelHost = process.env.COUP_DEV_TUNNEL_HOST?.trim().toLowerCase();

export default {
  allowedDevOrigins: tunnelHost ? [tunnelHost] : [],
};
