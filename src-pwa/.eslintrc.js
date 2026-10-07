module.exports = {

  overrides: [
    {
      files: ['custom-service-worker.ts'],

      env: {
        serviceworker: true,
      },
    },
  ],
};
